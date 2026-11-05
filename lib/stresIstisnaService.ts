import { SupabaseClient } from '@supabase/supabase-js';
import { StresTestiSonucu, IngilizceOdrSorunu, OdrAlinmamisOlcut, AsamadaVarOdrdeYokKanit } from './pukoStresTesti';

export interface StresIstisnaKaydi {
  donem_id: string;
  alt_olcut_id: number | string;
  sorun_tipi: string;
  kanit_kimligi: string;
  istisna_anahtari: string;
  aktif: boolean;
  gerekce?: string;
  kullanici_id?: string;
  tarih?: string;
}

/**
 * Kararlı ve benzersiz istisna anahtarı üretir:
 * ${donem_id}_${alt_olcut_id}_${sorun_tipi}_${kanit_kimligi}
 */
export function buildIstisnaAnahtari(params: {
  donemId: string;
  altOlcutId: number | string;
  sorunTipi: string;
  kanitKimligi?: string | null;
}): string {
  const donem = String(params.donemId || '').trim();
  const olcut = String(params.altOlcutId || '').trim();
  const tip = String(params.sorunTipi || '').trim().toLowerCase();
  const kanit = String(params.kanitKimligi || 'genel')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç_.-]/gi, '_');

  return `${donem}_${olcut}_${tip}_${kanit}`;
}

/**
 * Belirli bir dönem için istisnaları okur.
 * Tarayıcı ortamında RLS engeline takılmamak için /api/stres-istisna endpoint'ini kullanır;
 * sunucu/CLI ortamında doğrudan system_islem_loglari tablosunu sorgular.
 * Kayıtlar tarih sırasına (ascending) göre taranır; aynı anahtara sahip en son kayıt geçerli durumu belirler.
 */
export async function getirStresIstisnalari(
  supabase: SupabaseClient<any, any, any>,
  donemId: string,
  altOlcutId?: number | string
): Promise<Map<string, StresIstisnaKaydi>> {
  if (!donemId) return new Map();

  // 1. Tarayıcı ortamında yetki kontrolü yapan güvenli API üzerinden oku (Hocalarda RLS engeline takılmaz)
  if (typeof window !== 'undefined') {
    try {
      const url = new URL('/api/stres-istisna', window.location.origin);
      url.searchParams.set('donem_id', String(donemId));
      if (altOlcutId) {
        url.searchParams.set('alt_olcut_id', String(altOlcutId));
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const json = await res.json();
        const istisnaMap = new Map<string, StresIstisnaKaydi>();
        if (Array.isArray(json.data)) {
          json.data.forEach((item: StresIstisnaKaydi) => {
            if (item.istisna_anahtari) {
              istisnaMap.set(item.istisna_anahtari, item);
            }
          });
        }
        return istisnaMap;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('API getirStresIstisnalari yanıt hatası:', errJson.error);
      }
    } catch (apiErr) {
      console.warn('API getirStresIstisnalari çağrılamadı, veritabanından doğrudan deneniyor:', apiErr);
    }
  }

  // 2. Sunucu / CLI / Script ortamında doğrudan veritabanından oku
  const { data, error } = await supabase
    .from('system_islem_loglari')
    .select('user_id, islem_tipi, kayit_id, yeni_veri, tarih')
    .eq('islem_tipi', 'STRES_ISTISNA')
    .order('tarih', { ascending: true });

  if (error) {
    console.error('İstisna kayıtları okunamadı:', error);
    throw new Error(`İstisnalar yüklenirken hata oluştu: ${error.message}`);
  }

  const istisnaMap = new Map<string, StresIstisnaKaydi>();

  (data || []).forEach(row => {
    const payload = row.yeni_veri;
    if (payload && String(payload.donem_id) === String(donemId) && payload.istisna_anahtari) {
      istisnaMap.set(payload.istisna_anahtari, {
        donem_id: payload.donem_id,
        alt_olcut_id: payload.alt_olcut_id,
        sorun_tipi: payload.sorun_tipi,
        kanit_kimligi: payload.kanit_kimligi,
        istisna_anahtari: payload.istisna_anahtari,
        aktif: Boolean(payload.aktif),
        gerekce: payload.gerekce || '',
        kullanici_id: row.user_id,
        tarih: row.tarih,
      });
    }
  });

  return istisnaMap;
}

/**
 * Bir istisnayı kabul eder (aktif: true) veya geri alır (aktif: false).
 * Tarayıcı ortamında RLS yetkisi için /api/stres-istisna API endpoint'ini kullanır;
 * sunucu/CLI ortamında doğrudan system_islem_loglari tablosuna STRES_ISTISNA olarak yazar.
 * Hata durumunda exception fırlatarak arayüzün yanıltılmasını engeller.
 */
export async function kaydetStresIstisna(params: {
  supabase: SupabaseClient<any, any, any>;
  donemId: string;
  altOlcutId: number | string;
  sorunTipi: string;
  kanitKimligi?: string | null;
  aktif: boolean;
  gerekce?: string;
  userId?: string;
}): Promise<StresIstisnaKaydi> {
  const { supabase, donemId, altOlcutId, sorunTipi, kanitKimligi, aktif, gerekce, userId } = params;

  // 1. Tarayıcı ortamında yetki kontrolü yapan güvenli API üzerinden kaydet (Hoca RLS engeline takılmaz)
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/stres-istisna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donem_id: String(donemId),
        alt_olcut_id: String(altOlcutId),
        sorun_tipi: sorunTipi,
        kanit_kimligi: kanitKimligi || 'genel',
        aktif: Boolean(aktif),
        gerekce: gerekce || '',
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || 'İstisna API üzerinden kaydedilemedi');
    }

    return json.data;
  }

  // 2. Sunucu / CLI / Script ortamında doğrudan veritabanına yaz
  let finalUserId = userId;
  if (!finalUserId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      finalUserId = user?.id;
    } catch {}
  }

  const anahtar = buildIstisnaAnahtari({ donemId, altOlcutId, sorunTipi, kanitKimligi });

  const recordPayload: StresIstisnaKaydi = {
    donem_id: String(donemId),
    alt_olcut_id: String(altOlcutId),
    sorun_tipi: sorunTipi,
    kanit_kimligi: kanitKimligi || 'genel',
    istisna_anahtari: anahtar,
    aktif,
    gerekce: gerekce || '',
    kullanici_id: finalUserId,
  };

  const { error } = await supabase.from('system_islem_loglari').insert({
    user_id: finalUserId || null,
    islem_tipi: 'STRES_ISTISNA',
    tablo_adi: 'ozdegerlendirme_raporlari',
    kayit_id: String(altOlcutId),
    yeni_veri: recordPayload,
  });

  if (error) {
    console.error('İstisna kaydedilemedi:', error);
    throw new Error(`İstisna veritabanına kaydedilemedi: ${error.message}`);
  }

  return recordPayload;
}

/**
 * Stres testi sonuçlarını aktif istisnalara göre filtreler ve sayaçları yeniden hesaplar.
 */
export function filtreleStresSonuclari(params: {
  sonuc: StresTestiSonucu;
  istisnaMap: Map<string, StresIstisnaKaydi>;
  donemId: string;
}): {
  filtrelenmisSonuc: StresTestiSonucu;
  istisnaliSayilar: {
    odrAlinmamis: number;
    asamadaVarOdrdeYok: number;
    ingilizceOdr: number;
    toplamIstisna: number;
  };
} {
  const { sonuc, istisnaMap, donemId } = params;

  let istisnaliOdr = 0;
  const temizOdr = sonuc.odrAlinmamisOlcutler.filter(item => {
    const key = buildIstisnaAnahtari({
      donemId,
      altOlcutId: item.alt_olcut_id,
      sorunTipi: 'odr_yok',
      kanitKimligi: 'genel',
    });
    const istisna = istisnaMap.get(key);
    if (istisna && istisna.aktif) {
      istisnaliOdr++;
      return false;
    }
    return true;
  });

  let istisnaliKanit = 0;
  const temizKanit = sonuc.asamadaVarOdrdeYok.filter(item => {
    const key = buildIstisnaAnahtari({
      donemId,
      altOlcutId: item.alt_olcut_id,
      sorunTipi: 'kanit_fark',
      kanitKimligi: item.kanit_url || item.kanit_adi || item.puko_asamasi,
    });
    const istisna = istisnaMap.get(key);
    if (istisna && istisna.aktif) {
      istisnaliKanit++;
      return false;
    }
    return true;
  });

  let istisnaliIngilizce = 0;
  const temizIngilizce = sonuc.ingilizceOdrSorunlari.filter(item => {
    const key = buildIstisnaAnahtari({
      donemId,
      altOlcutId: item.alt_olcut_id,
      sorunTipi: item.sorun_tipi,
      kanitKimligi: item.eksik_kanitlar?.[0] || 'genel',
    });
    const istisna = istisnaMap.get(key);
    if (istisna && istisna.aktif) {
      istisnaliIngilizce++;
      return false;
    }
    return true;
  });

  const filtrelenmisSonuc: StresTestiSonucu = {
    odrAlinmamisOlcutler: temizOdr,
    asamadaVarOdrdeYok: temizKanit,
    bosAsamalar: sonuc.bosAsamalar || [],
    ingilizceOdrSorunlari: temizIngilizce,
    toplamSorun: temizOdr.length + temizKanit.length + temizIngilizce.length,
  };

  return {
    filtrelenmisSonuc,
    istisnaliSayilar: {
      odrAlinmamis: istisnaliOdr,
      asamadaVarOdrdeYok: istisnaliKanit,
      ingilizceOdr: istisnaliIngilizce,
      toplamIstisna: istisnaliOdr + istisnaliKanit + istisnaliIngilizce,
    },
  };
}
