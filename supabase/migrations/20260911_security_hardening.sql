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

-- 5. DOSYA YETKİLENDİRMELERİ TABLOSU (ADDITIVE & DÖNEM İZOLASYONLU)
CREATE TABLE IF NOT EXISTS public.dosya_yetkilendirmeleri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'puko', 'ozdegerlendirme_raporu', 'bildirim_revizyon', 'diger'
  resource_id TEXT,
  alt_olcut_id INT REFERENCES public.alt_olcutler(id) ON DELETE RESTRICT,
  puko_degerlendirme_id INT REFERENCES public.puko_degerlendirmeleri(id) ON DELETE SET NULL,
  ozdegerlendirme_raporu_id UUID REFERENCES public.ozdegerlendirme_raporlari(id) ON DELETE SET NULL,
  donem_id UUID REFERENCES public.donemler(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  original_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT uq_dosya_yetki_bucket_path UNIQUE (bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_dosya_yetki_lookup ON public.dosya_yetkilendirmeleri(bucket, storage_path);
CREATE INDEX IF NOT EXISTS idx_dosya_yetki_donem_olcut ON public.dosya_yetkilendirmeleri(donem_id, alt_olcut_id);
CREATE INDEX IF NOT EXISTS idx_dosya_yetki_resource ON public.dosya_yetkilendirmeleri(resource_type, resource_id);

ALTER TABLE public.dosya_yetkilendirmeleri ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dosya_yetkilendirmeleri FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.dosya_yetkilendirmeleri TO service_role;

-- 6. ANKET RATE LIMITS TABLOSU VE ATOMİK FONKSİYON
CREATE TABLE IF NOT EXISTS public.anket_rate_limits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_type TEXT NOT NULL, -- 'ip' veya 'session'
  key_value TEXT NOT NULL,
  anket_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 1,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_anket_rate_limit UNIQUE (key_type, key_value, anket_id)
);

CREATE INDEX IF NOT EXISTS idx_anket_rate_limit_lookup ON public.anket_rate_limits (key_type, key_value, anket_id);

ALTER TABLE public.anket_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.anket_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.anket_rate_limits TO service_role;

-- Tekil Sequence İzni (En Düşük Yetki İlkesi)
DO $$
DECLARE
  v_seq TEXT;
BEGIN
  v_seq := pg_get_serial_sequence('public.anket_rate_limits', 'id');
  IF v_seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', v_seq);
  END IF;
END $$;

-- Atomik Rate Limit Fonksiyonu (Yarış Durumu ve DoS Korumalı)
CREATE OR REPLACE FUNCTION public.check_and_increment_anket_rate_limit(
  p_key_type TEXT,
  p_key_value TEXT,
  p_anket_id UUID,
  p_window_seconds INTEGER,
  p_max_requests INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_count INT;
BEGIN
  IF p_key_value IS NULL OR trim(p_key_value) = '' THEN
    RAISE EXCEPTION 'Geçersiz kimlik anahtarı: boş olamaz';
  END IF;

  INSERT INTO public.anket_rate_limits (key_type, key_value, anket_id, window_start, request_count, last_request_at)
  VALUES (p_key_type, p_key_value, p_anket_id, v_now, 1, v_now)
  ON CONFLICT (key_type, key_value, anket_id) DO UPDATE
  SET 
    request_count = CASE 
      WHEN public.anket_rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL < v_now THEN 1
      ELSE public.anket_rate_limits.request_count + 1
    END,
    window_start = CASE 
      WHEN public.anket_rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL < v_now THEN v_now
      ELSE public.anket_rate_limits.window_start
    END,
    last_request_at = v_now
  RETURNING request_count INTO v_count;

  IF v_count > p_max_requests THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Tam İmzalı Fonksiyon Yetkilendirmesi
REVOKE EXECUTE ON FUNCTION public.check_and_increment_anket_rate_limit(TEXT, TEXT, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_anket_rate_limit(TEXT, TEXT, UUID, INTEGER, INTEGER) TO service_role;

-- 7. ANKET CEVAPLARI İSTEMCİ/ANONİM INSERT İPTALİ
REVOKE INSERT ON public.anket_cevaplari FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "anket_cevaplari_insert" ON public.anket_cevaplari;

-- 8. KESİNTİSİZ VE GÜVENLİ BACKFILL SORGULARI (CASE & DİZİ KORUMALI)

-- A. PUKÖ Kanıt Dosyaları Backfill
INSERT INTO public.dosya_yetkilendirmeleri (
  bucket, storage_path, resource_type, resource_id, alt_olcut_id, puko_degerlendirme_id, donem_id, original_url, metadata
)
SELECT 
  'dokumanlar',
  clean.storage_path,
  'puko',
  r.id::text,
  CASE 
    WHEN trim(r.alt_olcut_id::text) ~ '^[0-9]+$' THEN trim(r.alt_olcut_id::text)::INT 
    ELSE NULL 
  END,
  r.id,
  CASE 
    WHEN r.donem_id::text ~ '^[0-9a-fA-F-]{36}$' THEN r.donem_id::text::UUID 
    ELSE NULL 
  END,
  clean.raw_url,
  CASE WHEN jsonb_typeof(elem) = 'object' THEN elem ELSE jsonb_build_object('url', elem #>> '{}') END
FROM public.puko_degerlendirmeleri r,
LATERAL jsonb_array_elements(
  CASE 
    WHEN r.kanit_dosyalari IS NOT NULL AND jsonb_typeof(r.kanit_dosyalari) = 'array' THEN r.kanit_dosyalari 
    ELSE '[]'::jsonb 
  END
) AS elem,
LATERAL (
  SELECT 
    COALESCE(elem->>'url', CASE WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}' END) AS raw_url,
    substring(
      COALESCE(elem->>'url', CASE WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}' END)
      FROM '/dokumanlar/([^?#]+)'
    ) AS storage_path
) clean
WHERE clean.storage_path IS NOT NULL AND trim(clean.storage_path) != ''
ON CONFLICT (bucket, storage_path) DO UPDATE
SET 
  puko_degerlendirme_id = EXCLUDED.puko_degerlendirme_id,
  donem_id = COALESCE(public.dosya_yetkilendirmeleri.donem_id, EXCLUDED.donem_id),
  alt_olcut_id = COALESCE(public.dosya_yetkilendirmeleri.alt_olcut_id, EXCLUDED.alt_olcut_id);

-- B. ÖDR Kanıtları Backfill
INSERT INTO public.dosya_yetkilendirmeleri (
  bucket, storage_path, resource_type, resource_id, alt_olcut_id, ozdegerlendirme_raporu_id, donem_id, original_url, metadata
)
SELECT 
  'dokumanlar',
  clean.storage_path,
  'ozdegerlendirme_raporu',
  r.id::text,
  CASE 
    WHEN trim(r.alt_olcut_id::text) ~ '^[0-9]+$' THEN trim(r.alt_olcut_id::text)::INT 
    ELSE NULL 
  END,
  r.id,
  CASE 
    WHEN r.donem_id::text ~ '^[0-9a-fA-F-]{36}$' THEN r.donem_id::text::UUID 
    ELSE NULL 
  END,
  clean.raw_url,
  CASE WHEN jsonb_typeof(elem) = 'object' THEN elem ELSE jsonb_build_object('url', elem #>> '{}') END
FROM public.ozdegerlendirme_raporlari r,
LATERAL jsonb_array_elements(
  CASE 
    WHEN r.kanitlar IS NOT NULL AND jsonb_typeof(r.kanitlar) = 'array' THEN r.kanitlar 
    ELSE '[]'::jsonb 
  END
) AS elem,
LATERAL (
  SELECT 
    COALESCE(elem->>'url', CASE WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}' END) AS raw_url,
    substring(
      COALESCE(elem->>'url', CASE WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}' END)
      FROM '/dokumanlar/([^?#]+)'
    ) AS storage_path
) clean
WHERE clean.storage_path IS NOT NULL AND trim(clean.storage_path) != ''
ON CONFLICT (bucket, storage_path) DO UPDATE
SET 
  ozdegerlendirme_raporu_id = EXCLUDED.ozdegerlendirme_raporu_id,
  donem_id = COALESCE(public.dosya_yetkilendirmeleri.donem_id, EXCLUDED.donem_id),
  alt_olcut_id = COALESCE(public.dosya_yetkilendirmeleri.alt_olcut_id, EXCLUDED.alt_olcut_id);

-- 9. TAMAMLANMA BİLDİRİMİ
DO $$
BEGIN
  RAISE NOTICE 'BKY Güvenlik Sertleştirme, İki Katmanlı Rate Limit ve Dosya Yetkilendirme Paketi (v3) başarıyla hazırlandı.';
END $$;
