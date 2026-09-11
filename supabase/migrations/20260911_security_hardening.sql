-- ==============================================================================
-- BKY / ABYS AKREDİTASYON SİSTEMİ - TAM GÜVENLİK SERTLEŞTİRME VE YETKİ KORUMA PAKETİ
-- Kapsam: Canlı Veritabanları (ESOGÜ, HARRAN ve 3. Canlı Sistem)
-- Sıfır kesinti: Mevcut verileri ve hocaların profillerini/raporlarını asla silmez/bozmaz.
-- ==============================================================================

-- 1. PROFİLLER TABLOSU SÜTUN KORUMA TETİKLEYİCİSİ (UPDATE - FAIL CLOSE)
CREATE OR REPLACE FUNCTION public.protect_profiller_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- FAIL-CLOSE KONTROLÜ: JWT claim yoksa veya service_role değilse koruma bloğu ZORUNLU çalışır
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role' THEN
    -- Kullanıcı rolünü değiştirmeye çalışıyorsa ve kendisi bir sistem yöneticisi değilse engelle:
    IF NEW.rol IS DISTINCT FROM OLD.rol THEN
      IF NOT (
        EXISTS (
          SELECT 1 FROM public.profiller 
          WHERE id = auth.uid() 
          AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
        )
      ) THEN
        RAISE EXCEPTION 'Güvenlik İhlali: Kullanıcı kendi rolünü değiştiremez.';
      END IF;
    END IF;

    -- Kullanıcı ID ve email kolonları da istemci tarafından asla değiştirilemez:
    NEW.id := OLD.id;
    NEW.email := OLD.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profiller_sensitive_columns ON public.profiller;
CREATE TRIGGER trg_protect_profiller_sensitive_columns
  BEFORE UPDATE ON public.profiller
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiller_sensitive_columns();

-- 2. PROFİLLER TABLOSU YENİ KAYIT ROL KORUMASI (INSERT - FAIL CLOSE)
CREATE OR REPLACE FUNCTION public.protect_profiller_insert_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role' THEN
    IF NEW.rol IS NOT NULL AND NEW.rol ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']) THEN
      IF NOT (
        EXISTS (
          SELECT 1 FROM public.profiller 
          WHERE id = auth.uid() 
          AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
        )
      ) THEN
        NEW.rol := 'Beklemede';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profiller_insert_columns ON public.profiller;
CREATE TRIGGER trg_protect_profiller_insert_columns
  BEFORE INSERT ON public.profiller
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiller_insert_columns();

-- 3. RLS POLİTİKASININ GÜNCELLENMESİ
DROP POLICY IF EXISTS "profiller_update_own" ON public.profiller;
CREATE POLICY "profiller_update_own" ON public.profiller
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. STORAGE (DOSYA DEPOLAMA) BUCKET GİZLİLİĞİ VE RLS SERTLEŞTİRMESİ
-- A. Bucket Gizliliği: Tamamen Private (public = false) ve Depolama Seviyesi MIME & Boyut Sınırı
UPDATE storage.buckets 
SET public = false,
    file_size_limit = 26214400, -- 25 MB Maksimum
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
WHERE id IN ('kanit_dosyalari', 'dokumanlar');

-- B. Okuma Politikası: Yalnızca sisteme giriş yapmış yetkili kullanıcılar (authenticated) okuyabilir
DROP POLICY IF EXISTS "dokumanlar_select" ON storage.objects;
CREATE POLICY "dokumanlar_select" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (bucket_id = 'dokumanlar');

DROP POLICY IF EXISTS "kanit_dosyalari_select" ON storage.objects;
CREATE POLICY "kanit_dosyalari_select" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (bucket_id = 'kanit_dosyalari');

-- C. Yükleme: Uzantı + MIME Türü + Boyut + Çift Uzantı / Polyglot Koruması
DROP POLICY IF EXISTS "dokumanlar_insert" ON storage.objects;
CREATE POLICY "dokumanlar_insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'dokumanlar' 
    -- 1. Uzantı Doğrulaması
    AND LOWER(storage.extension(name)) IN ('pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'doc', 'xls')
    -- 2. Çift uzantı ve çalıştırılabilir dosya koruması (polyglot engeli)
    AND name !~* '\.(exe|bat|cmd|sh|php|phtml|jsp|asp|aspx|cgi|pl|py|js|vbs|jar)\.'
    -- 3. Gerçek MIME Türü Doğrulaması (metadata->>mimetype)
    AND (
      (LOWER(storage.extension(name)) = 'pdf' AND metadata->>'mimetype' = 'application/pdf')
      OR (LOWER(storage.extension(name)) = 'png' AND metadata->>'mimetype' = 'image/png')
      OR (LOWER(storage.extension(name)) IN ('jpg', 'jpeg') AND metadata->>'mimetype' IN ('image/jpeg', 'image/jpg'))
      OR (LOWER(storage.extension(name)) = 'webp' AND metadata->>'mimetype' = 'image/webp')
      OR (LOWER(storage.extension(name)) = 'docx' AND metadata->>'mimetype' IN ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'))
      OR (LOWER(storage.extension(name)) = 'xlsx' AND metadata->>'mimetype' IN ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'))
      OR (LOWER(storage.extension(name)) = 'doc' AND metadata->>'mimetype' = 'application/msword')
      OR (LOWER(storage.extension(name)) = 'xls' AND metadata->>'mimetype' = 'application/vnd.ms-excel')
    )
    -- 4. Boyut Sınırı: Maksimum 25MB
    AND (
      metadata->>'size' IS NULL 
      OR (metadata->>'size')::bigint <= 26214400
    )
  );

DROP POLICY IF EXISTS "kanit_dosyalari_insert" ON storage.objects;
CREATE POLICY "kanit_dosyalari_insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'kanit_dosyalari' 
    -- 1. Uzantı Doğrulaması
    AND LOWER(storage.extension(name)) IN ('pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'doc', 'xls')
    -- 2. Çift uzantı ve çalıştırılabilir dosya koruması (polyglot engeli)
    AND name !~* '\.(exe|bat|cmd|sh|php|phtml|jsp|asp|aspx|cgi|pl|py|js|vbs|jar)\.'
    -- 3. Gerçek MIME Türü Doğrulaması (metadata->>mimetype)
    AND (
      (LOWER(storage.extension(name)) = 'pdf' AND metadata->>'mimetype' = 'application/pdf')
      OR (LOWER(storage.extension(name)) = 'png' AND metadata->>'mimetype' = 'image/png')
      OR (LOWER(storage.extension(name)) IN ('jpg', 'jpeg') AND metadata->>'mimetype' IN ('image/jpeg', 'image/jpg'))
      OR (LOWER(storage.extension(name)) = 'webp' AND metadata->>'mimetype' = 'image/webp')
      OR (LOWER(storage.extension(name)) = 'docx' AND metadata->>'mimetype' IN ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'))
      OR (LOWER(storage.extension(name)) = 'xlsx' AND metadata->>'mimetype' IN ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'))
      OR (LOWER(storage.extension(name)) = 'doc' AND metadata->>'mimetype' = 'application/msword')
      OR (LOWER(storage.extension(name)) = 'xls' AND metadata->>'mimetype' = 'application/vnd.ms-excel')
    )
    -- 4. Boyut Sınırı: Maksimum 25MB
    AND (
      metadata->>'size' IS NULL 
      OR (metadata->>'size')::bigint <= 26214400
    )
  );

-- D. Güncelleme ve Silme: YALNIZCA DOSYANIN SAHİBİ (OWNER) VEYA YÖNETİCİ
DROP POLICY IF EXISTS "dokumanlar_update" ON storage.objects;
CREATE POLICY "dokumanlar_update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (
    bucket_id = 'dokumanlar' 
    AND (
      auth.uid() = owner 
      OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%'])
    )
  );

DROP POLICY IF EXISTS "dokumanlar_delete" ON storage.objects;
CREATE POLICY "dokumanlar_delete" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (
    bucket_id = 'dokumanlar' 
    AND (
      auth.uid() = owner 
      OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%'])
    )
  );

DROP POLICY IF EXISTS "kanit_dosyalari_update" ON storage.objects;
CREATE POLICY "kanit_dosyalari_update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (
    bucket_id = 'kanit_dosyalari' 
    AND (
      auth.uid() = owner 
      OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%'])
    )
  );

DROP POLICY IF EXISTS "kanit_dosyalari_delete" ON storage.objects;
CREATE POLICY "kanit_dosyalari_delete" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (
    bucket_id = 'kanit_dosyalari' 
    AND (
      auth.uid() = owner 
      OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%'])
    )
  );

-- 5. ANONİM ANKET SUNUCU TARAFI (SERVER-SIDE) RATE LIMIT VE GÜVENLİK
-- A. Kolon Ekleme (Oturum / Kişi ve Güvenli IP Hash takibi)
ALTER TABLE public.anket_cevaplari ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE public.anket_cevaplari ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_anket_cevaplari_session ON public.anket_cevaplari(anket_id, session_token, katilim_tarihi);
CREATE INDEX IF NOT EXISTS idx_anket_cevaplari_ip_hash ON public.anket_cevaplari(anket_id, ip_hash, katilim_tarihi);

-- B. Rate Limit ve DoS Engelleme Fonksiyonu
CREATE OR REPLACE FUNCTION public.rate_limit_anket_cevaplari()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Anketin geçerli ve mevcut olduğunu doğrula
  IF NOT EXISTS (SELECT 1 FROM public.anketler WHERE id = NEW.anket_id) THEN
    RAISE EXCEPTION 'Geçersiz anket IDsi.';
  END IF;

  -- 2. Cevaplar JSON kontrolü (Boş veya aşırı büyük JSON engeli, max 64KB)
  IF NEW.cevaplar IS NULL OR pg_column_size(NEW.cevaplar) > 65536 THEN
    RAISE EXCEPTION 'Geçersiz veya aşırı büyük anket verisi.';
  END IF;

  -- 3. Kişi / Oturum bazlı flood engeli (Aynı session_token son 15 saniyede aynı ankete cevap vermişse engelle)
  IF NEW.session_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.anket_cevaplari
    WHERE anket_id = NEW.anket_id
    AND session_token = NEW.session_token
    AND katilim_tarihi > (NOW() - INTERVAL '15 seconds')
  ) THEN
    RAISE EXCEPTION 'Bu cihazdan/oturumdan çok sık yanıt gönderildi. Lütfen 15 saniye bekleyin.';
  END IF;

  -- 4. IP Hash bazlı flood engeli (Aynı IP hash son 1 dakikada 5''ten fazla yanıt gönderemez)
  IF NEW.ip_hash IS NOT NULL AND (
    SELECT COUNT(*) FROM public.anket_cevaplari
    WHERE anket_id = NEW.anket_id
    AND ip_hash = NEW.ip_hash
    AND katilim_tarihi > (NOW() - INTERVAL '1 minute')
  ) >= 5 THEN
    RAISE EXCEPTION 'Aynı ağdan/IP adresinden kısa sürede çok fazla yanıt gönderildi. Lütfen biraz bekleyin.';
  END IF;

  -- NOT: Global anket kilidi tamamen kaldırılmıştır. Farklı kullanıcıların aynı anda yanıt göndermesi engellenmez (DoS korumalı).

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rate_limit_anket_cevaplari ON public.anket_cevaplari;
CREATE TRIGGER trg_rate_limit_anket_cevaplari
  BEFORE INSERT ON public.anket_cevaplari
  FOR EACH ROW
  EXECUTE FUNCTION public.rate_limit_anket_cevaplari();

DROP POLICY IF EXISTS "anket_cevaplari_insert" ON public.anket_cevaplari;
CREATE POLICY "anket_cevaplari_insert" ON public.anket_cevaplari
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.anketler WHERE id = anket_id)
    AND cevaplar IS NOT NULL
  );

-- 6. TAMAMLANMA BİLDİRİMİ
DO $$
BEGIN
  RAISE NOTICE 'Tam güvenlik sertleştirme paketi (v2 - DoS & MIME & Bucket Privacy) başarıyla yüklendi.';
END $$;
