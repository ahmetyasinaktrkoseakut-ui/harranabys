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

-- 4. STORAGE (DOSYA DEPOLAMA) RLS SERTLEŞTİRMESİ (NESNE SAHİPLİĞİ & TÜR DENETİMİ)
-- A. Okuma: Giriş yapmış kullanıcılar
DROP POLICY IF EXISTS "dokumanlar_select" ON storage.objects;
CREATE POLICY "dokumanlar_select" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (bucket_id = 'dokumanlar');

DROP POLICY IF EXISTS "kanit_dosyalari_select" ON storage.objects;
CREATE POLICY "kanit_dosyalari_select" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (bucket_id = 'kanit_dosyalari');

-- B. Yükleme: Sadece izin verilen uzantılar (Uzantısız dosya kesinlikle yasak)
DROP POLICY IF EXISTS "dokumanlar_insert" ON storage.objects;
CREATE POLICY "dokumanlar_insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'dokumanlar' 
    AND LOWER(storage.extension(name)) IN ('pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'zip')
  );

DROP POLICY IF EXISTS "kanit_dosyalari_insert" ON storage.objects;
CREATE POLICY "kanit_dosyalari_insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'kanit_dosyalari' 
    AND LOWER(storage.extension(name)) IN ('pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'zip')
  );

-- C. Güncelleme ve Silme: YALNIZCA DOSYANIN SAHİBİ (OWNER) VEYA YÖNETİCİ
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
CREATE OR REPLACE FUNCTION public.rate_limit_anket_cevaplari()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Anketin geçerli ve mevcut olduğunu doğrula
  IF NOT EXISTS (SELECT 1 FROM public.anketler WHERE id = NEW.anket_id) THEN
    RAISE EXCEPTION 'Geçersiz anket IDsi.';
  END IF;

  -- 2. Cevaplar JSON kontrolü (Boş veya aşırı büyük JSON engeli)
  IF NEW.cevaplar IS NULL OR pg_column_size(NEW.cevaplar) > 65536 THEN
    RAISE EXCEPTION 'Geçersiz veya aşırı büyük anket verisi.';
  END IF;

  -- 3. Sunucu Tarafı Flood Koruması: Aynı anket_id için son 1 saniyede ekleme yapılmışsa bekle
  IF EXISTS (
    SELECT 1 FROM public.anket_cevaplari
    WHERE anket_id = NEW.anket_id
    AND katilim_tarihi > (NOW() - INTERVAL '1 second')
  ) THEN
    RAISE EXCEPTION 'Aşırı istek algılandı. Lütfen birkaç saniye sonra tekrar deneyin.';
  END IF;

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
  RAISE NOTICE 'Tam güvenlik sertleştirme paketi başarıyla yüklendi. Tüm açıklar kapatıldı.';
END $$;
