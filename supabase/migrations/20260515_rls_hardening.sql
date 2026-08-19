-- ==========================================
-- BKY SISTEMI GUVENLIK SERTLESTIRME PAKETI (ZIRHLI)
-- ==========================================

-- 1. TRANSACTIONAL RPC FONKSIYONLARI (YETKI KONTROLLU)
-- ------------------------------------------

CREATE OR REPLACE FUNCTION rpc_v3_assign_all_olcutler(
  p_user_id UUID,
  p_donem_id UUID,
  p_olcut_ids INT[]
)
RETURNS VOID AS $$
BEGIN
  -- YETKI KONTROLU
  IF NOT EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Atama yapma yetkiniz yok.';
  END IF;

  DELETE FROM kullanici_olcut_atamalari WHERE user_id = p_user_id AND donem_id = p_donem_id;

  IF p_olcut_ids IS NOT NULL AND array_length(p_olcut_ids, 1) > 0 THEN
    INSERT INTO kullanici_olcut_atamalari (user_id, donem_id, alt_olcut_id)
    SELECT p_user_id, p_donem_id, unnest(p_olcut_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_v3_sync_birim_atamalari(
  p_user_id UUID,
  p_donem_id UUID,
  p_scope_olcut_ids INT[],
  p_selected_olcut_ids INT[]
)
RETURNS VOID AS $$
BEGIN
  -- YETKI KONTROLU
  IF NOT EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Atama yetkiniz yok.';
  END IF;

  DELETE FROM kullanici_olcut_atamalari WHERE user_id = p_user_id AND donem_id = p_donem_id AND alt_olcut_id = ANY(p_scope_olcut_ids);
  DELETE FROM kullanici_olcut_atamalari WHERE donem_id = p_donem_id AND alt_olcut_id = ANY(p_selected_olcut_ids) AND user_id != p_user_id;

  IF p_selected_olcut_ids IS NOT NULL AND array_length(p_selected_olcut_ids, 1) > 0 THEN
    INSERT INTO kullanici_olcut_atamalari (user_id, donem_id, alt_olcut_id)
    SELECT p_user_id, p_donem_id, unnest(p_selected_olcut_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_v3_assign_koordinator(
  p_user_id UUID,
  p_baslik TEXT
)
RETURNS VOID AS $$
BEGIN
  -- YETKI KONTROLU
  IF NOT EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Koordinatör atama yetkiniz yok.';
  END IF;

  DELETE FROM baslik_koordinatorleri WHERE kullanici_id = p_user_id;
  INSERT INTO baslik_koordinatorleri (kullanici_id, baslik) VALUES (p_user_id, p_baslik);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RLS (ROW LEVEL SECURITY) POLICIES (FULL WRITE ACCESS FOR ASSIGNED USERS)
-- ------------------------------------------

ALTER TABLE kullanici_olcut_atamalari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own assignments" ON kullanici_olcut_atamalari;
CREATE POLICY "Users can view own assignments" ON kullanici_olcut_atamalari FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')));
DROP POLICY IF EXISTS "Admins can modify assignments" ON kullanici_olcut_atamalari;
CREATE POLICY "Admins can modify assignments" ON kullanici_olcut_atamalari FOR ALL USING (EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')));

ALTER TABLE baslik_koordinatorleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Viewable by all" ON baslik_koordinatorleri;
CREATE POLICY "Viewable by all" ON baslik_koordinatorleri FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only admins can modify coordinators" ON baslik_koordinatorleri;
CREATE POLICY "Only admins can modify coordinators" ON baslik_koordinatorleri FOR ALL USING (EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')));

ALTER TABLE puko_degerlendirmeleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users view" ON puko_degerlendirmeleri;
CREATE POLICY "Authenticated users view" ON puko_degerlendirmeleri FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can manage assigned evaluations" ON puko_degerlendirmeleri;
CREATE POLICY "Users can manage assigned evaluations" ON puko_degerlendirmeleri FOR ALL USING (EXISTS (SELECT 1 FROM kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = puko_degerlendirmeleri.alt_olcut_id AND ka.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')));

ALTER TABLE ozdegerlendirme_raporlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users view reports" ON ozdegerlendirme_raporlari;
CREATE POLICY "Authenticated users view reports" ON ozdegerlendirme_raporlari FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can manage assigned reports" ON ozdegerlendirme_raporlari;
CREATE POLICY "Users can manage assigned reports" ON ozdegerlendirme_raporlari FOR ALL USING (EXISTS (SELECT 1 FROM kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = ozdegerlendirme_raporlari.alt_olcut_id AND ka.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')));
