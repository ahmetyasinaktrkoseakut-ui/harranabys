-- ==========================================
-- BKY SISTEMI GUVENLIK SERTLESTIRME PAKETI - V2 (TAM KORUMA)
-- ==========================================

-- 1. profiller RLS POLICIES
ALTER TABLE public.profiller ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiller_read_all" ON public.profiller;
CREATE POLICY "profiller_read_all" ON public.profiller
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "profiller_update_own" ON public.profiller;
CREATE POLICY "profiller_update_own" ON public.profiller
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiller_admin_all" ON public.profiller;
CREATE POLICY "profiller_admin_all" ON public.profiller
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );

-- 2. donemler RLS POLICIES
ALTER TABLE public.donemler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donemler_read_all" ON public.donemler;
CREATE POLICY "donemler_read_all" ON public.donemler
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "donemler_admin_all" ON public.donemler;
CREATE POLICY "donemler_admin_all" ON public.donemler
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );

-- 3. birimler RLS POLICIES
ALTER TABLE public.birimler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "birimler_read_all" ON public.birimler;
CREATE POLICY "birimler_read_all" ON public.birimler
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "birimler_admin_all" ON public.birimler;
CREATE POLICY "birimler_admin_all" ON public.birimler
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );

-- 4. dokumanlar RLS POLICIES
ALTER TABLE public.dokumanlar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dokumanlar_read_all" ON public.dokumanlar;
CREATE POLICY "dokumanlar_read_all" ON public.dokumanlar
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dokumanlar_manage_assigned" ON public.dokumanlar;
CREATE POLICY "dokumanlar_manage_assigned" ON public.dokumanlar
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.kullanici_olcut_atamalari ka 
      WHERE ka.alt_olcut_id = public.dokumanlar.alt_olcut_id 
      AND ka.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );

-- 5. system_islem_loglari RLS POLICIES
ALTER TABLE public.system_islem_loglari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_islem_loglari_read" ON public.system_islem_loglari;
CREATE POLICY "system_islem_loglari_read" ON public.system_islem_loglari
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
    OR EXISTS (
      SELECT 1 FROM public.baslik_koordinatorleri 
      WHERE kullanici_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "system_islem_loglari_insert" ON public.system_islem_loglari;
CREATE POLICY "system_islem_loglari_insert" ON public.system_islem_loglari
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. duyurular RLS POLICIES
ALTER TABLE public.duyurular ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duyurular_read_all" ON public.duyurular;
CREATE POLICY "duyurular_read_all" ON public.duyurular
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "duyurular_admin_all" ON public.duyurular;
CREATE POLICY "duyurular_admin_all" ON public.duyurular
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );

-- 7. anketler RLS POLICIES
ALTER TABLE public.anketler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anketler_read_all" ON public.anketler;
CREATE POLICY "anketler_read_all" ON public.anketler
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anketler_manage_assigned" ON public.anketler;
CREATE POLICY "anketler_manage_assigned" ON public.anketler
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.kullanici_olcut_atamalari ka 
      WHERE ka.alt_olcut_id = public.anketler.alt_olcut_id 
      AND ka.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );

-- 8. anket_cevaplari RLS POLICIES
ALTER TABLE public.anket_cevaplari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anket_cevaplari_insert" ON public.anket_cevaplari;
CREATE POLICY "anket_cevaplari_insert" ON public.anket_cevaplari
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anket_cevaplari_read_assigned" ON public.anket_cevaplari;
CREATE POLICY "anket_cevaplari_read_assigned" ON public.anket_cevaplari
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.anketler a
      LEFT JOIN public.kullanici_olcut_atamalari ka ON ka.alt_olcut_id = a.alt_olcut_id
      WHERE a.id = public.anket_cevaplari.anket_id
      AND (ka.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiller p WHERE p.id = auth.uid() AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yönetici%' OR p.rol ILIKE '%yonetici%')))
    )
  );

-- 9. ana_basliklar, olcutler, alt_olcutler RLS POLICIES
ALTER TABLE public.ana_basliklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olcutler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alt_olcutler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ana_basliklar_read" ON public.ana_basliklar;
CREATE POLICY "ana_basliklar_read" ON public.ana_basliklar FOR SELECT USING (true);

DROP POLICY IF EXISTS "olcutler_read" ON public.olcutler;
CREATE POLICY "olcutler_read" ON public.olcutler FOR SELECT USING (true);

DROP POLICY IF EXISTS "alt_olcutler_read" ON public.alt_olcutler;
CREATE POLICY "alt_olcutler_read" ON public.alt_olcutler FOR SELECT USING (true);

DROP POLICY IF EXISTS "ana_basliklar_admin" ON public.ana_basliklar;
CREATE POLICY "ana_basliklar_admin" ON public.ana_basliklar FOR ALL USING (EXISTS (SELECT 1 FROM public.profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')));

DROP POLICY IF EXISTS "olcutler_admin" ON public.olcutler;
CREATE POLICY "olcutler_admin" ON public.olcutler FOR ALL USING (EXISTS (SELECT 1 FROM public.profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')));

DROP POLICY IF EXISTS "alt_olcutler_update_assigned" ON public.alt_olcutler;
CREATE POLICY "alt_olcutler_update_assigned" ON public.alt_olcutler
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.kullanici_olcut_atamalari ka 
      WHERE ka.alt_olcut_id = public.alt_olcutler.id 
      AND ka.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );

DROP POLICY IF EXISTS "alt_olcutler_admin_insert_delete" ON public.alt_olcutler;
CREATE POLICY "alt_olcutler_admin_insert_delete" ON public.alt_olcutler
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiller 
      WHERE id = auth.uid() 
      AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')
    )
  );
