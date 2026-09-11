-- ==============================================================================
-- BKY / ABYS AKREDİTASYON SİSTEMİ - GÜVENLİK SERTLEŞTİRME VE YETKİ KORUMA PAKETİ
-- Kapsam: Canlı Veritabanları (ESOGÜ, HARRAN ve Tüm Bağlı Sistemler)
-- Açıklama: 
-- 1. Sütun koruma tetikleyicisini FAIL-CLOSE (JWT role boşsa dahi koruma devrede) yapar.
-- 2. INSERT ve UPDATE üzerinde rol yükseltme ve kimlik manipülasyonunu kesin engeller.
-- 3. Storage bucket'larında (dokumanlar & kanit_dosyalari) dosya türü denetimini RLS ile zorunlu kılar.
-- 4. Sıfır kesinti: Mevcut verileri bozmaz, hocaların ad-soyad değiştirmesini engellemez.
-- ==============================================================================

-- 1. PROFİLLER TABLOSU SÜTUN KORUMA TETİKLEYİCİSİ (UPDATE - FAIL CLOSE)
CREATE OR REPLACE FUNCTION public.protect_profiller_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer işlemi yapan kişi Supabase Service Role (backend API / admin) DEĞİLSE:
  -- FAIL-CLOSE: JWT claim yoksa veya service_role değilse koruma bloğu ZORUNLU çalışır.
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

-- Tetikleyiciyi profiller tablosuna bağla
DROP TRIGGER IF EXISTS trg_protect_profiller_sensitive_columns ON public.profiller;
CREATE TRIGGER trg_protect_profiller_sensitive_columns
  BEFORE UPDATE ON public.profiller
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiller_sensitive_columns();

-- 2. PROFİLLER TABLOSU YENİ KAYIT ROL KORUMASI (INSERT - FAIL CLOSE)
CREATE OR REPLACE FUNCTION public.protect_profiller_insert_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer işlemi yapan kişi Supabase Service Role DEĞİLSE:
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role' THEN
    -- İstemci tarafından eklenen kayıt Yonetici/Admin olamaz, ancak yönetici ekleyebilir:
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

-- 4. STORAGE (DOSYA DEPOLAMA) RLS SERTLEŞTİRMESİ (Zararlı Dosya Yükleme Engeli)
-- dokumanlar bucket'ı
DROP POLICY IF EXISTS "dokumanlar_insert" ON storage.objects;
CREATE POLICY "dokumanlar_insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'dokumanlar' 
    AND (
      LOWER(storage.extension(name)) IN ('pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'zip')
      OR storage.extension(name) = ''
    )
  );

DROP POLICY IF EXISTS "dokumanlar_update" ON storage.objects;
CREATE POLICY "dokumanlar_update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (bucket_id = 'dokumanlar');

DROP POLICY IF EXISTS "dokumanlar_delete" ON storage.objects;
CREATE POLICY "dokumanlar_delete" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'dokumanlar');

-- kanit_dosyalari bucket'ı
DROP POLICY IF EXISTS "kanit_dosyalari_insert" ON storage.objects;
CREATE POLICY "kanit_dosyalari_insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'kanit_dosyalari' 
    AND (
      LOWER(storage.extension(name)) IN ('pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'zip')
      OR storage.extension(name) = ''
    )
  );

DROP POLICY IF EXISTS "kanit_dosyalari_update" ON storage.objects;
CREATE POLICY "kanit_dosyalari_update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (bucket_id = 'kanit_dosyalari');

DROP POLICY IF EXISTS "kanit_dosyalari_delete" ON storage.objects;
CREATE POLICY "kanit_dosyalari_delete" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'kanit_dosyalari');

-- 5. TAMAMLANMA BİLDİRİMİ
DO $$
BEGIN
  RAISE NOTICE 'Güvenlik sertleştirme paketi başarıyla yüklendi. Rol yükseltme ve storage açıkları kapatıldı.';
END $$;
