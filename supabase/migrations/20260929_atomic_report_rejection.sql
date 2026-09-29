-- Migration: 20260929_atomic_report_rejection.sql
-- Amaç: Rapor reddetme işlemini ACID transaction içinde atomik yürütmek.
-- Kapsam: HARRAN ABYS, Akreditasyon Yedek ve 39 Taslak

CREATE OR REPLACE FUNCTION public.rapor_reddet_atomic(
  p_rapor_id UUID,
  p_red_nedeni TEXT,
  p_gonderen_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
  v_alt_olcut RECORD;
  v_target_user_id UUID;
  v_alt_olcut_id_int BIGINT;
BEGIN
  -- 1. Eşzamanlı istekleri engellemek için satırı kilitle (FOR UPDATE)
  SELECT 
    id, 
    alt_olcut_id, 
    donem_id, 
    onay_durumu, 
    red_nedeni
  INTO v_report
  FROM public.ozdegerlendirme_raporlari
  WHERE id = p_rapor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rapor kaydı bulunamadı.';
  END IF;

  -- 2. Genel İdempotency: Rapor zaten reddedilmişse (gerekçeden bağımsız) dur ve çift bildirim üretme
  IF v_report.onay_durumu = 'reddedildi' THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'message', 'Rapor zaten reddedilmiş durumda.'
    );
  END IF;

  -- 3. Ölçüt bilgilerini sunucuda çek (Tip güvenli ::text karşılaştırması)
  SELECT id, kod, olcut_adi
  INTO v_alt_olcut
  FROM public.alt_olcutler
  WHERE id::text = v_report.alt_olcut_id::text;

  -- 4. Raporu güncelle (Şema uyumlu: updated_at aranmaz)
  UPDATE public.ozdegerlendirme_raporlari
  SET onay_durumu = 'reddedildi',
      red_nedeni = p_red_nedeni
  WHERE id = p_rapor_id;

  -- 5. PUKÖ değerlendirmelerini 'Reddedildi' yap (Tip güvenli ::text karşılaştırması)
  UPDATE public.puko_degerlendirmeleri
  SET durum = 'Reddedildi',
      red_nedeni = p_red_nedeni
  WHERE alt_olcut_id::text = v_report.alt_olcut_id::text
    AND donem_id = v_report.donem_id;

  -- 6. Bildirimin gideceği kullanıcıyı (hoca) tespit et
  SELECT user_id
  INTO v_target_user_id
  FROM public.kullanici_olcut_atamalari
  WHERE alt_olcut_id::text = v_report.alt_olcut_id::text
    AND donem_id = v_report.donem_id
  LIMIT 1;

  -- 7. Bildirim ekle (Dayanıklı: Hoca bulunamazsa veya bildirim tablosunda sorun olursa ana ret işlemi geri alınmaz)
  IF v_target_user_id IS NOT NULL THEN
    BEGIN
      v_alt_olcut_id_int := NULL;
      -- Tip güvenli sayısal dönüşüm: önce text kontrolü, ardından bigint
      IF (v_report.alt_olcut_id::text) ~ '^[0-9]+$' THEN
        v_alt_olcut_id_int := (v_report.alt_olcut_id::text)::BIGINT;
      END IF;

      INSERT INTO public.bildirimler (
        gonderen_id,
        alici_id,
        mesaj,
        tip,
        ilgili_kayit_id
      ) VALUES (
        p_gonderen_id,
        v_target_user_id,
        COALESCE(v_alt_olcut.kod, 'Alt Ölçüt') || ' Değerlendirmesi REDDEDİLDİ. Neden: ' || p_red_nedeni,
        'red',
        v_alt_olcut_id_int
      );
    EXCEPTION WHEN OTHERS THEN
      -- Bildirim hatası ana ret/PUKÖ işlemini geri almaz; loglanarak devam edilir
      RAISE NOTICE 'Bildirim ekleme uyarısı (ret işlemi korundu): %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Güvenlik yetkilendirmesi: Yalnızca service_role çalıştırabilir
REVOKE ALL ON FUNCTION public.rapor_reddet_atomic(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rapor_reddet_atomic(UUID, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.rapor_reddet_atomic(UUID, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rapor_reddet_atomic(UUID, TEXT, UUID) TO service_role;
