-- ==========================================
-- BKY SISTEMI GUVENLIK SERTLESTIRME PAKETI - V3 (SELECT POLICIES HATA AZALTMA VE KORUMA)
-- ==========================================

-- 1. puko_degerlendirmeleri SELECT politikasını sıkılaştır
DROP POLICY IF EXISTS "Authenticated users view" ON public.puko_degerlendirmeleri;
DROP POLICY IF EXISTS "puko_degerlendirmeleri_read_secure" ON public.puko_degerlendirmeleri;

CREATE POLICY "puko_degerlendirmeleri_read_secure" ON public.puko_degerlendirmeleri
  FOR SELECT TO authenticated
  USING (
    -- Admins, yöneticiler ve gözlemciler okuyabilir
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%' OR rol ILIKE '%gözlemci%' OR rol ILIKE '%gozlemci%')
    )
    -- Koordinatörler kendi başlıklarına ait olanları okuyabilir
    OR EXISTS (
      SELECT 1 FROM public.baslik_koordinatorleri bk
      JOIN public.alt_olcutler ao ON ao.id = public.puko_degerlendirmeleri.alt_olcut_id
      JOIN public.ana_basliklar ab ON ab.id = ao.ana_baslik_id
      WHERE bk.kullanici_id = auth.uid()
      AND (
        (bk.baslik = 'Kalite Güvencesi' AND ab.baslik_adi = 'KALİTE GÜVENCESİ SİSTEMİ') OR
        (bk.baslik = 'Eğitim-Öğretim' AND ab.baslik_adi = 'EĞİTİM VE ÖĞRETİM') OR
        (bk.baslik = 'Araştırma ve Geliştirme' AND ab.baslik_adi = 'ARAŞTIRMA VE GELİŞTİRME') OR
        (bk.baslik = 'Toplumsal Katkı' AND ab.baslik_adi = 'TOPLUMSAL KATKI') OR
        (bk.baslik = 'Yönetim Sistemi' AND ab.baslik_adi = 'YÖNETİM SİSTEMİ')
      )
    )
    -- Birim sorumluları kendi atandıkları ölçütleri okuyabilir
    OR EXISTS (
      SELECT 1 FROM public.kullanici_olcut_atamalari ka 
      WHERE ka.alt_olcut_id = public.puko_degerlendirmeleri.alt_olcut_id 
      AND ka.user_id = auth.uid()
    )
  );

-- 2. ozdegerlendirme_raporlari SELECT politikasını sıkılaştır (alt_olcut_id veritabanında metin olduğu için ::integer dönüşümü yapılmıştır)
DROP POLICY IF EXISTS "Authenticated users view reports" ON public.ozdegerlendirme_raporlari;
DROP POLICY IF EXISTS "ozdegerlendirme_raporlari_read_secure" ON public.ozdegerlendirme_raporlari;

CREATE POLICY "ozdegerlendirme_raporlari_read_secure" ON public.ozdegerlendirme_raporlari
  FOR SELECT TO authenticated
  USING (
    -- Admins, yöneticiler ve gözlemciler okuyabilir
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%' OR rol ILIKE '%gözlemci%' OR rol ILIKE '%gozlemci%')
    )
    -- Koordinatörler kendi başlıklarına ait olanları okuyabilir
    OR EXISTS (
      SELECT 1 FROM public.baslik_koordinatorleri bk
      JOIN public.alt_olcutler ao ON ao.id = public.ozdegerlendirme_raporlari.alt_olcut_id::integer
      JOIN public.ana_basliklar ab ON ab.id = ao.ana_baslik_id
      WHERE bk.kullanici_id = auth.uid()
      AND (
        (bk.baslik = 'Kalite Güvencesi' AND ab.baslik_adi = 'KALİTE GÜVENCESİ SİSTEMİ') OR
        (bk.baslik = 'Eğitim-Öğretim' AND ab.baslik_adi = 'EĞİTİM VE ÖĞRETİM') OR
        (bk.baslik = 'Araştırma ve Geliştirme' AND ab.baslik_adi = 'ARAŞTIRMA VE GELİŞTİRME') OR
        (bk.baslik = 'Toplumsal Katkı' AND ab.baslik_adi = 'TOPLUMSAL KATKI') OR
        (bk.baslik = 'Yönetim Sistemi' AND ab.baslik_adi = 'YÖNETİM SİSTEMİ')
      )
    )
    -- Birim sorumluları kendi atandıkları ölçütleri okuyabilir
    OR EXISTS (
      SELECT 1 FROM public.kullanici_olcut_atamalari ka 
      WHERE ka.alt_olcut_id = public.ozdegerlendirme_raporlari.alt_olcut_id::integer 
      AND ka.user_id = auth.uid()
    )
  );
