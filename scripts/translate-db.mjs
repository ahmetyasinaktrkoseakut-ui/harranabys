import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// .env.local dosyasındaki değişkenleri yükle
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('HATA: .env.local dosyasında NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY bulunamadı.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function translateText(text, targetLang) {
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    return data[0][0][0];
  } catch (error) {
    console.error(`Çeviri hatası (${targetLang}):`, error);
    return null;
  }
}

async function processAnaBasliklar() {
  console.log('--- ana_basliklar tablosu işleniyor ---');
  const { data, error } = await supabase.from('ana_basliklar').select('*');

  if (error) {
    console.error('ana_basliklar çekilemedi:', error);
    return;
  }

  for (const row of data) {
    if (!row.baslik_adi) continue;

    let needsUpdate = false;
    const updates = {};

    if (!row.baslik_adi_en) {
      console.log(`[EN] Çevriliyor: ${row.baslik_adi}`);
      const enTrans = await translateText(row.baslik_adi, 'en');
      if (enTrans) {
        updates.baslik_adi_en = enTrans;
        needsUpdate = true;
      }
    }

    if (!row.baslik_adi_ar) {
      console.log(`[AR] Çevriliyor: ${row.baslik_adi}`);
      const arTrans = await translateText(row.baslik_adi, 'ar');
      if (arTrans) {
        updates.baslik_adi_ar = arTrans;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const { error: updateErr } = await supabase.from('ana_basliklar').update(updates).eq('id', row.id);
      if (updateErr) {
        console.error(`Güncelleme hatası (ID: ${row.id}):`, updateErr);
      } else {
        console.log(`Başarıyla güncellendi: ID ${row.id}`);
      }
    }

    // API rate limit'e takılmamak için kısa bekleme
    await new Promise(r => setTimeout(r, 500));
  }
}

async function processAltOlcutler() {
  console.log('--- alt_olcutler tablosu işleniyor ---');
  const { data, error } = await supabase.from('alt_olcutler').select('*');

  if (error) {
    console.error('alt_olcutler çekilemedi:', error);
    return;
  }

  for (const row of data) {
    if (!row.olcut_adi) continue;

    let needsUpdate = false;
    const updates = {};

    if (!row.olcut_adi_en) {
      console.log(`[EN] Çevriliyor: ${row.olcut_adi}`);
      const enTrans = await translateText(row.olcut_adi, 'en');
      if (enTrans) {
        updates.olcut_adi_en = enTrans;
        needsUpdate = true;
      }
    }

    if (!row.olcut_adi_ar) {
      console.log(`[AR] Çevriliyor: ${row.olcut_adi}`);
      const arTrans = await translateText(row.olcut_adi, 'ar');
      if (arTrans) {
        updates.olcut_adi_ar = arTrans;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const { error: updateErr } = await supabase.from('alt_olcutler').update(updates).eq('id', row.id);
      if (updateErr) {
        console.error(`Güncelleme hatası (ID: ${row.id}):`, updateErr);
      } else {
        console.log(`Başarıyla güncellendi: ID ${row.id}`);
      }
    }

    // API rate limit'e takılmamak için kısa bekleme
    await new Promise(r => setTimeout(r, 500));
  }
}

async function processOlcutler() {
  console.log('--- olcutler tablosu işleniyor ---');
  const { data, error } = await supabase.from('olcutler').select('*');

  if (error) {
    console.error('olcutler çekilemedi:', error);
    return;
  }

  for (const row of data) {
    if (!row.olcut_adi) continue;

    let needsUpdate = false;
    const updates = {};

    if (!row.olcut_adi_en) {
      console.log(`[EN] Çevriliyor: ${row.olcut_adi}`);
      const enTrans = await translateText(row.olcut_adi, 'en');
      if (enTrans) {
        updates.olcut_adi_en = enTrans;
        needsUpdate = true;
      }
    }

    if (!row.olcut_adi_ar) {
      console.log(`[AR] Çevriliyor: ${row.olcut_adi}`);
      const arTrans = await translateText(row.olcut_adi, 'ar');
      if (arTrans) {
        updates.olcut_adi_ar = arTrans;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const { error: updateErr } = await supabase.from('olcutler').update(updates).eq('id', row.id);
      if (updateErr) {
        console.error(`Güncelleme hatası (ID: ${row.id}):`, updateErr);
      } else {
        console.log(`Başarıyla güncellendi: ID ${row.id}`);
      }
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

async function run() {
  console.log('Veritabanı otomatik çeviri işlemi başlatıldı...');
  await processAnaBasliklar();
  await processOlcutler();
  await processAltOlcutler();
  console.log('İşlem tamamlandı!');
}

run();
