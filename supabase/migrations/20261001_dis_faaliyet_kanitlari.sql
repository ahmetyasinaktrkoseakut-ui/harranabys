-- ==============================================================================
-- Migration: 20261001_dis_faaliyet_kanitlari.sql
-- Amaç: Dış faaliyet kanıtı toplama, RLS koruması ve PUKÖ atomik aktarım fonksiyonları.
-- Kapsam: ESOGÜ İlahiyat Fakültesi ABYS (ve gelecekteki sistemler)
-- ==============================================================================

-- 1. DIŞ FAALİYET KANITLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.dis_faaliyet_kanitlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donem_id UUID NOT NULL REFERENCES public.donemler(id) ON DELETE CASCADE,
  alt_olcut_id INT NOT NULL REFERENCES public.alt_olcutler(id) ON DELETE CASCADE,
  ad_soyad TEXT NOT NULL,
  email TEXT,
  faaliyet_turu TEXT NOT NULL,
  faaliyet_adi TEXT NOT NULL,
  duzenleyen_kurum TEXT,
  faaliyet_tarihi DATE NOT NULL,
  aciklama TEXT,
  dosya_adi TEXT NOT NULL,
  dosya_url TEXT NOT NULL,
  dosya_boyutu INT, -- KB cinsinden
  durum TEXT DEFAULT 'beklemede' CHECK (durum IN ('beklemede', 'onaylandi', 'reddedildi')),
  olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW(),
  karar_veren_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
  karar_tarihi TIMESTAMPTZ,
  aktarilan_kanit_no INT,
  aktarilan_evidence_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_dis_faaliyet_donem_olcut ON public.dis_faaliyet_kanitlari(donem_id, alt_olcut_id);
CREATE INDEX IF NOT EXISTS idx_dis_faaliyet_durum ON public.dis_faaliyet_kanitlari(durum);

-- 2. RLS GÜVENLİK POLİTİKALARI (Supabase Zorunlu Kuralı)
ALTER TABLE public.dis_faaliyet_kanitlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dis_faaliyet_select_secure" ON public.dis_faaliyet_kanitlari;
CREATE POLICY "dis_faaliyet_select_secure" ON public.dis_faaliyet_kanitlari
FOR SELECT TO authenticated
USING (
  -- 1. Admin / Yönetici
  EXISTS (
    SELECT 1 FROM public.profiller p 
    WHERE p.id = auth.uid() 
      AND p.rol ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%'])
  )
  -- 2. Ölçüt Sorumlusu Hoca
  OR EXISTS (
    SELECT 1 FROM public.kullanici_olcut_atamalari ka
    WHERE ka.alt_olcut_id = public.dis_faaliyet_kanitlari.alt_olcut_id
      AND ka.donem_id = public.dis_faaliyet_kanitlari.donem_id
      AND ka.user_id = auth.uid()
  )
  -- 3. Başlık Koordinatörü (Kanonik Başlık Eşleşmeli)
  OR EXISTS (
    SELECT 1 FROM public.baslik_koordinatorleri bk
    JOIN public.alt_olcutler ao ON ao.id = public.dis_faaliyet_kanitlari.alt_olcut_id
    JOIN public.ana_basliklar ab ON ab.id = ao.ana_baslik_id
    WHERE bk.kullanici_id = auth.uid() 
      AND (
        (bk.baslik = 'Kalite Güvencesi' AND ab.baslik_adi = 'KALİTE GÜVENCESİ SİSTEMİ') OR
        (bk.baslik = 'Eğitim-Öğretim' AND ab.baslik_adi = 'EĞİTİM VE ÖĞRETİM') OR
        (bk.baslik = 'Araştırma ve Geliştirme' AND ab.baslik_adi = 'ARAŞTIRMA VE GELİŞTİRME') OR
        (bk.baslik = 'Toplumsal Katkı' AND ab.baslik_adi = 'TOPLUMSAL KATKI') OR
        (bk.baslik = 'Yönetim Sistemi' AND ab.baslik_adi = 'YÖNETİM SİSTEMİ') OR
        bk.baslik = ab.baslik_adi OR
        bk.baslik = ab.kod
      )
  )
);

-- İstemciden doğrudan UPDATE ve DELETE izinleri kaldırılır
REVOKE UPDATE, DELETE ON public.dis_faaliyet_kanitlari FROM PUBLIC, anon, authenticated;

-- Dış formun aktif dönemi görebilmesi için donemler tablosuna genel okuma izni
DROP POLICY IF EXISTS "donemler_read_all" ON public.donemler;
CREATE POLICY "donemler_read_all" ON public.donemler FOR SELECT USING (true);

-- 3. ATOMİK KANITA AKTARMA FONKSİYONU (RPC)
CREATE OR REPLACE FUNCTION public.faaliyet_kaniti_aktar_atomic(
  p_faaliyet_id UUID,
  p_kullanici_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_faaliyet RECORD;
  v_puko_uygulama RECORD;
  v_puko_planlama RECORD;
  v_yeni_kanit JSONB;
  v_mevcut_kanitlar JSONB;
  v_onceki_kanit_sayisi INT := 0;
  v_yeni_kanit_no INT;
  v_kanit_etiketi TEXT;
  v_ev_id TEXT;
BEGIN
  -- 1. Faaliyet satırını FOR UPDATE ile kilitle
  SELECT * INTO v_faaliyet
  FROM public.dis_faaliyet_kanitlari
  WHERE id = p_faaliyet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faaliyet kaydı bulunamadı.';
  END IF;

  IF v_faaliyet.durum != 'beklemede' THEN
    RAISE EXCEPTION 'Bu faaliyet zaten işleme alınmış (Durum: %).', v_faaliyet.durum;
  END IF;

  -- 2. 'planlama' satırını FOR UPDATE ile kilitle (eşzamanlı eklemelere karşı koru)
  SELECT * INTO v_puko_planlama
  FROM public.puko_degerlendirmeleri
  WHERE alt_olcut_id = v_faaliyet.alt_olcut_id
    AND donem_id = v_faaliyet.donem_id
    AND puko_asamasi = 'planlama'
  FOR UPDATE;

  IF FOUND AND v_puko_planlama.kanit_dosyalari IS NOT NULL THEN
    v_onceki_kanit_sayisi := jsonb_array_length(v_puko_planlama.kanit_dosyalari);
  ELSE
    v_onceki_kanit_sayisi := 0;
  END IF;

  -- 3. 'uygulama' satırını FOR UPDATE ile kilitle (küçük harf 'uygulama')
  SELECT * INTO v_puko_uygulama
  FROM public.puko_degerlendirmeleri
  WHERE alt_olcut_id = v_faaliyet.alt_olcut_id
    AND donem_id = v_faaliyet.donem_id
    AND puko_asamasi = 'uygulama'
  FOR UPDATE;

  -- Henüz uygulama kaydı kaydedilmemişse güvenli şekilde otomatik oluştur
  IF NOT FOUND THEN
    INSERT INTO public.puko_degerlendirmeleri (
      alt_olcut_id,
      donem_id,
      puko_asamasi,
      aciklama,
      kanit_dosyalari,
      durum
    ) VALUES (
      v_faaliyet.alt_olcut_id,
      v_faaliyet.donem_id,
      'uygulama',
      '',
      '[]'::jsonb,
      'Taslak'
    )
    RETURNING * INTO v_puko_uygulama;
  END IF;

  v_mevcut_kanitlar := COALESCE(v_puko_uygulama.kanit_dosyalari, '[]'::jsonb);
  v_yeni_kanit_no := v_onceki_kanit_sayisi + jsonb_array_length(v_mevcut_kanitlar) + 1;
  v_kanit_etiketi := 'Kanıt ' || v_yeni_kanit_no;
  v_ev_id := gen_random_uuid()::text;

  -- 4. Birebir PhaseClient uyumlu JSON objesi
  v_yeni_kanit := jsonb_build_object(
    'evidence_id', v_ev_id,
    'evidence_no', v_yeni_kanit_no,
    'name', v_faaliyet.dosya_adi,
    'url', v_faaliyet.dosya_url,
    'size', COALESCE(v_faaliyet.dosya_boyutu, 0)
  );

  -- 5. PUKÖ tablosuna kanıtı ekle
  UPDATE public.puko_degerlendirmeleri
  SET kanit_dosyalari = v_mevcut_kanitlar || jsonb_build_array(v_yeni_kanit)
  WHERE id = v_puko_uygulama.id;

  -- 6. Faaliyet tablosunda durumu ve denetim izini güncelle
  UPDATE public.dis_faaliyet_kanitlari
  SET durum = 'onaylandi',
      karar_veren_id = p_kullanici_id,
      karar_tarihi = NOW(),
      aktarilan_kanit_no = v_yeni_kanit_no,
      aktarilan_evidence_id = v_ev_id
  WHERE id = p_faaliyet_id;

  RETURN jsonb_build_object(
    'success', true,
    'evidence_id', v_ev_id,
    'evidence_no', v_yeni_kanit_no,
    'kanit_etiketi', v_kanit_etiketi,
    'dosya', v_yeni_kanit,
    'atif_metni', TO_CHAR(v_faaliyet.faaliyet_tarihi, 'DD.MM.YYYY') || ' tarihinde ' || 
                  COALESCE(v_faaliyet.duzenleyen_kurum, 'ilgili kurum') || ' bünyesinde ' || 
                  v_faaliyet.ad_soyad || ' tarafından gerçekleştirilen ' || 
                  v_faaliyet.faaliyet_adi || ' faaliyeti gerçekleştirilmiştir [' || v_kanit_etiketi || '].'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.faaliyet_kaniti_aktar_atomic(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.faaliyet_kaniti_aktar_atomic(UUID, UUID) TO service_role;

-- 4. ATOMİK REDDETME FONKSİYONU (RPC)
CREATE OR REPLACE FUNCTION public.faaliyet_kaniti_reddet_atomic(
  p_faaliyet_id UUID,
  p_kullanici_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INT;
BEGIN
  -- Yalnızca 'beklemede' olan kaydı kilitleyip reddet
  UPDATE public.dis_faaliyet_kanitlari
  SET durum = 'reddedildi',
      karar_veren_id = p_kullanici_id,
      karar_tarihi = NOW()
  WHERE id = p_faaliyet_id
    AND durum = 'beklemede';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kayıt bulunamadı veya zaten işleme alınmış.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.faaliyet_kaniti_reddet_atomic(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.faaliyet_kaniti_reddet_atomic(UUID, UUID) TO service_role;
