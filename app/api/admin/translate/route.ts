import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function translateText(text: string, targetLang: string) {
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    return data[0][0][0];
  } catch (error) {
    console.error(`Çeviri hatası (${targetLang}):`, error);
    return null;
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Kullanıcının admin olup olmadığını kontrol et
  const { data: profile } = await supabase
    .from('profiller')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  const userRole = (profile?.rol ?? '').toLowerCase();
  if (!userRole.includes('admin') && !userRole.includes('yönetici') && !userRole.includes('yonetici')) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const results: any = { ana_basliklar: [], alt_olcutler: [] };

  // 1. Ana Başlıklar
  const { data: anaBasliklar, error: anaError } = await supabase.from('ana_basliklar').select('*');
  if (anaError) {
    return NextResponse.json({ error: anaError.message }, { status: 500 });
  }

  if (anaBasliklar) {
    for (const row of anaBasliklar) {
      if (!row.baslik_adi) continue;

      let needsUpdate = false;
      const updates: any = {};

      if (!row.baslik_adi_en) {
        const enTrans = await translateText(row.baslik_adi, 'en');
        if (enTrans) { updates.baslik_adi_en = enTrans; needsUpdate = true; }
      }

      if (!row.baslik_adi_ar) {
        const arTrans = await translateText(row.baslik_adi, 'ar');
        if (arTrans) { updates.baslik_adi_ar = arTrans; needsUpdate = true; }
      }

      if (needsUpdate) {
        const { error: updErr } = await supabase.from('ana_basliklar').update(updates).eq('id', row.id);
        if (updErr) {
          console.error(`Ana başlık güncelleme hatası (ID: ${row.id}):`, updErr);
          continue;
        }
        results.ana_basliklar.push({ id: row.id, updates });
      }
    }
  }

  // 2. Alt Ölçütler
  const { data: altOlcutler, error: altError } = await supabase.from('alt_olcutler').select('*');
  if (altError) {
    return NextResponse.json({ error: altError.message }, { status: 500 });
  }

  if (altOlcutler) {
    for (const row of altOlcutler) {
      if (!row.olcut_adi) continue;

      let needsUpdate = false;
      const updates: any = {};

      if (!row.olcut_adi_en) {
        const enTrans = await translateText(row.olcut_adi, 'en');
        if (enTrans) { updates.olcut_adi_en = enTrans; needsUpdate = true; }
      }

      if (!row.olcut_adi_ar) {
        const arTrans = await translateText(row.olcut_adi, 'ar');
        if (arTrans) { updates.olcut_adi_ar = arTrans; needsUpdate = true; }
      }

      if (needsUpdate) {
        const { error: updErr } = await supabase.from('alt_olcutler').update(updates).eq('id', row.id);
        if (updErr) {
          console.error(`Alt ölçüt güncelleme hatası (ID: ${row.id}):`, updErr);
          continue;
        }
        results.alt_olcutler.push({ id: row.id, updates });
      }
    }
  }

  return NextResponse.json({
    message: 'Veritabanı çevirileri başarıyla tamamlandı.',
    updated_records: results
  });
}
