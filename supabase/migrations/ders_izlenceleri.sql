-- ============================================================
-- DERS İZLENÇELERİ MODÜLÜ — TAM EĞİTİM PLANI VE SEED VERİSİ
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dersler (
  kod TEXT PRIMARY KEY,
  ad TEXT DEFAULT '',
  t INTEGER DEFAULT 0,
  u INTEGER DEFAULT 0,
  l INTEGER DEFAULT 0,
  kredi INTEGER DEFAULT 0,
  akts INTEGER DEFAULT 0,
  yariyil TEXT DEFAULT '',
  tur TEXT DEFAULT 'Zorunlu'
);

CREATE TABLE IF NOT EXISTS public.ders_izlenceleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ders_id TEXT REFERENCES public.dersler(kod) ON DELETE CASCADE,
  hoca_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  icerik JSONB DEFAULT '{}',
  guncelleme_tarihi TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ders_id, hoca_id)
);

ALTER TABLE public.dersler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ders_izlenceleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dersler_read_all" ON public.dersler FOR SELECT USING (true);
CREATE POLICY "izlenceler_read_all" ON public.ders_izlenceleri FOR SELECT USING (true);
CREATE POLICY "izlenceler_all_own" ON public.ders_izlenceleri FOR ALL USING (auth.uid() = hoca_id);

-- DERS LİSTESİ - TÜM YARIYILLAR (2024 EĞİTİM PLANI)
INSERT INTO public.dersler (kod, ad, t, u, l, kredi, akts, yariyil, tur) VALUES
('181111026', 'Kur’an Okuma ve Tecvid I', 2, 0, 0, 2, 3, 'I. YARIYIL', 'Zorunlu'),
('181111025', 'Arap Dili I', 4, 0, 0, 4, 2, 'I. YARIYIL', 'Zorunlu'),
('181111024', 'İslam Tarihi I', 2, 0, 0, 2, 5, 'I. YARIYIL', 'Zorunlu'),
('181111038', 'Tefsir I', 2, 0, 0, 2, 5, 'I. YARIYIL', 'Zorunlu'),
('181111039', 'Fıkıh I', 2, 0, 0, 2, 3, 'I. YARIYIL', 'Zorunlu'),
('181111040', 'Kelam I', 2, 0, 0, 2, 3, 'I. YARIYIL', 'Zorunlu'),
('181011001', 'Türk Dili I', 2, 0, 0, 2, 2, 'I. YARIYIL', 'Zorunlu'),
('181011004', 'Atatürk İlkeleri ve İnkılap Tarihi I', 2, 0, 0, 2, 2, 'I. YARIYIL', 'Zorunlu'),
('181011005', 'Yabancı Dil I', 2, 0, 0, 2, 2, 'I. YARIYIL', 'Zorunlu'),
('181112041', 'Kur’an Okuma ve Tecvid II', 2, 0, 0, 2, 4, 'II. YARIYIL', 'Zorunlu'),
('181112042', 'Arap Dili II', 4, 0, 0, 4, 2, 'II. YARIYIL', 'Zorunlu'),
('181112043', 'İslam Tarihi II', 2, 0, 0, 2, 5, 'II. YARIYIL', 'Zorunlu'),
('181112044', 'Tefsir II', 2, 0, 0, 2, 5, 'II. YARIYIL', 'Zorunlu'),
('181112045', 'Fıkıh II', 2, 0, 0, 2, 4, 'II. YARIYIL', 'Zorunlu'),
('181112046', 'Hadis II', 2, 0, 0, 2, 4, 'II. YARIYIL', 'Zorunlu'),
('181012002', 'Türk Dili II', 2, 0, 0, 2, 2, 'II. YARIYIL', 'Zorunlu'),
('181012003', 'Atatürk İlkeleri ve İnkılap Tarihi II', 2, 0, 0, 2, 2, 'II. YARIYIL', 'Zorunlu'),
('181012006', 'Yabancı Dil II', 2, 0, 0, 2, 2, 'II. YARIYIL', 'Zorunlu'),
('181113035', 'Tefsir III', 2, 0, 0, 2, 5, 'III. YARIYIL', 'Zorunlu'),
('181113036', 'Hadis I', 2, 0, 0, 2, 3, 'III. YARIYIL', 'Zorunlu'),
('181113037', 'Fıkıh III', 2, 0, 0, 2, 3, 'III. YARIYIL', 'Zorunlu'),
('181113038', 'Kelam III', 2, 0, 0, 2, 2, 'III. YARIYIL', 'Zorunlu'),
('181113039', 'İslam Tarihi III', 2, 0, 0, 2, 3, 'III. YARIYIL', 'Zorunlu'),
('181113040', 'Arap Dili III', 2, 0, 0, 2, 3, 'III. YARIYIL', 'Zorunlu'),
('181113041', 'Tasavvuf I', 2, 0, 0, 2, 5, 'III. YARIYIL', 'Zorunlu'),
('181113050', 'Dinler Tarihi I', 2, 0, 0, 2, 3, 'III. YARIYIL', 'Zorunlu'),
('181115060', 'Tefsir V', 2, 0, 0, 2, 6, 'V. YARIYIL', 'Zorunlu'),
('181115061', 'Hadis III', 2, 0, 0, 2, 5, 'V. YARIYIL', 'Zorunlu'),
('181115062', 'Fıkıh V', 2, 0, 0, 2, 4, 'V. YARIYIL', 'Zorunlu'),
('181115063', 'Kelam V', 2, 0, 0, 2, 4, 'V. YARIYIL', 'Zorunlu'),
('181115064', 'İslam Felsefesi I', 2, 0, 0, 2, 5, 'V. YARIYIL', 'Zorunlu'),
('181115065', 'Din Eğitimi I', 2, 0, 0, 2, 4, 'V. YARIYIL', 'Zorunlu'),
('181115066', 'Dinler Tarihi III', 2, 0, 0, 2, 4, 'V. YARIYIL', 'Zorunlu'),
('181117072', 'Tefsir VII', 2, 0, 0, 2, 6, 'VII. YARIYIL', 'Zorunlu'),
('181117073', 'Hadis V', 2, 0, 0, 2, 3, 'VII. YARIYIL', 'Zorunlu'),
('181117074', 'Fıkıh VII', 2, 0, 0, 2, 4, 'VII. YARIYIL', 'Zorunlu'),
('181117075', 'Kelam VII', 2, 0, 0, 2, 4, 'VII. YARIYIL', 'Zorunlu'),
('181117046', 'İslam Sanatları', 2, 0, 0, 2, 4, 'VII. YARIYIL', 'Zorunlu'),
('181117076', 'Mezuniyet Tezi / Bitirme Ödevi', 0, 4, 0, 2, 5, 'VII. YARIYIL', 'Zorunlu')
ON CONFLICT (kod) DO UPDATE SET
  ad = EXCLUDED.ad,
  t = EXCLUDED.t,
  u = EXCLUDED.u,
  l = EXCLUDED.l,
  kredi = EXCLUDED.kredi,
  akts = EXCLUDED.akts,
  yariyil = EXCLUDED.yariyil;
