-- ==============================================================================
-- BKY / ABYS AKREDİTASYON SİSTEMİ - GÜVENLİ VE ZARARSIZ GERİ DÖNÜŞ (ROLLBACK) MİGRASYONU
-- Tarih: 2026-09-11
-- Güvenceler:
--   1. KESİNLİKLE DROP TABLE veya DROP COLUMN çalıştırmaz.
--   2. dosya_yetkilendirmeleri ve anket_rate_limits tablolarını ve verilerini silmez.
--   3. anket_cevaplari tablosuna anonim INSERT yetkisini ASLA yeniden açmaz.
-- ==============================================================================

-- 1. PROFİLLER TETİKLEYİCİLERİNİ GÜVENLİ KALDIRMA
DROP TRIGGER IF EXISTS trg_protect_profiller_sensitive_columns ON public.profiller;
DROP FUNCTION IF EXISTS public.protect_profiller_sensitive_columns();

DROP TRIGGER IF EXISTS trg_protect_profiller_insert_columns ON public.profiller;
DROP FUNCTION IF EXISTS public.protect_profiller_insert_columns();

-- 2. RATE LIMIT RPC FONKSİYONUNU GÜVENLİ KALDIRMA
DROP FUNCTION IF EXISTS public.check_and_increment_anket_rate_limit(TEXT, TEXT, UUID, INTEGER, INTEGER);

-- 3. STORAGE RLS POLİTİKALARINI GÜVENLİ SIFIRLAMA
DROP POLICY IF EXISTS "dokumanlar_select" ON storage.objects;
DROP POLICY IF EXISTS "kanit_dosyalari_select" ON storage.objects;
DROP POLICY IF EXISTS "dokumanlar_insert" ON storage.objects;
DROP POLICY IF EXISTS "kanit_dosyalari_insert" ON storage.objects;
DROP POLICY IF EXISTS "dokumanlar_update" ON storage.objects;
DROP POLICY IF EXISTS "dokumanlar_delete" ON storage.objects;
DROP POLICY IF EXISTS "kanit_dosyalari_update" ON storage.objects;
DROP POLICY IF EXISTS "kanit_dosyalari_delete" ON storage.objects;

-- 4. BUCKET AYARLARININ DURUMU
-- Güvenlik notu: Bucket'lar private (public = false) olarak kalmaya devam eder.
-- Gerekirse manuel olarak UPDATE storage.buckets SET public = true WHERE id IN ('dokumanlar', 'kanit_dosyalari'); çalıştırılabilir.

-- 5. BİLGİLENDİRME
DO $$
BEGIN
  RAISE NOTICE 'Rollback başarıyla tamamlandı: Fonksiyonlar ve politikalar geri alındı. Yeni tablolar ve veriler bozulmadan korundu.';
END $$;
