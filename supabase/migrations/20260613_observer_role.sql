-- 1. YENI RPC: KOORDINATOR VEYA GOZLEMCI ATAMA FONKSIYONU (SECURE DEFINER)
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_v4_assign_koordinator_with_role(
  p_user_id UUID,
  p_baslik TEXT,
  p_rol TEXT -- 'Koordinatör' veya 'Gözlemci'
)
RETURNS VOID AS $$
DECLARE
  current_role TEXT;
BEGIN
  -- YETKI KONTROLU
  IF NOT EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Atama yapma yetkiniz yok.';
  END IF;

  -- Kullanıcının mevcut rolünü al
  SELECT rol INTO current_role FROM profiller WHERE id = p_user_id;

  -- Eğer kullanıcı yönetici ise, rolünü değiştirmeyi engelle (Güvenlik Önlemi!)
  IF current_role ILIKE '%admin%' OR current_role ILIKE '%yönetici%' OR current_role ILIKE '%yonetici%' THEN
    -- Yöneticinin rolü değiştirilemez ama koordinatörlük/gözlemcilik kaydı baslik_koordinatorleri tablosuna eklenir.
  ELSE
    -- Eğer atanan rol 'Gözlemci' ise profiller tablosundaki rolünü 'Gozlemci' yap
    IF p_rol = 'Gözlemci' OR p_rol = 'Gozlemci' THEN
      UPDATE profiller SET rol = 'Gozlemci' WHERE id = p_user_id;
    ELSE
      -- Değilse varsayılan rol olan 'BirimSorumlusu' yap (standart koordinatörler de bu roldedir)
      UPDATE profiller SET rol = 'BirimSorumlusu' WHERE id = p_user_id;
    END IF;
  END IF;

  -- baslik_koordinatorleri tablosuna ekle
  -- (Daha önceki ataması varsa çakışmayı önlemek için önce siliyoruz)
  DELETE FROM baslik_koordinatorleri WHERE kullanici_id = p_user_id AND baslik = p_baslik;
  INSERT INTO baslik_koordinatorleri (kullanici_id, baslik) VALUES (p_user_id, p_baslik);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. YENI RPC: KOORDINATOR VEYA GOZLEMCI SILME VE ROL SIFIRLAMA FONKSIYONU (SECURE DEFINER)
-- ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_v4_remove_koordinator(
  p_user_id UUID,
  p_baslik TEXT
)
RETURNS VOID AS $$
DECLARE
  current_role TEXT;
BEGIN
  -- YETKI KONTROLU
  IF NOT EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Atama silme yetkiniz yok.';
  END IF;

  -- Atamayı sil
  DELETE FROM baslik_koordinatorleri WHERE kullanici_id = p_user_id AND baslik = p_baslik;

  -- Eğer başka bir başlıkta ataması kalmadıysa ve rolü 'Gozlemci' ise profilini varsayılana sıfırla
  IF NOT EXISTS (SELECT 1 FROM baslik_koordinatorleri WHERE kullanici_id = p_user_id) THEN
    SELECT rol INTO current_role FROM profiller WHERE id = p_user_id;
    IF current_role = 'Gozlemci' THEN
      UPDATE profiller SET rol = 'BirimSorumlusu' WHERE id = p_user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
