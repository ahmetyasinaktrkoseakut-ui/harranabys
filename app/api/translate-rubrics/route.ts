import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Vercel execution timeout limit (adjust based on your plan, Hobby allows max 60s)
export const maxDuration = 60;

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured' }, { status: 500 });
    }

    if (!openaiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not defined in environment variables' }, { status: 500 });
    }

    // Güvenlik Yaması: API'yi çağıran kişinin gerçekten Yönetici olup olmadığını kontrol et.
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabaseAuth.from('profiller').select('rol').eq('id', user.id).single();
    const userRole = (profile?.rol ?? '').toLowerCase();
    const isAdmin = userRole.includes('yönetici') || userRole.includes('admin') || userRole.includes('yonetici');
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    // Yetki onaylandı, şimdi işlemleri yapmak için servis rolünü kullan
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // 1. Fetch records where olgunluk_duzeyleri is not null but translations are null
    const { data: records, error: fetchError } = await supabase
      .from('alt_olcutler')
      .select('id, olgunluk_duzeyleri')
      .not('olgunluk_duzeyleri', 'is', null)
      .or('olgunluk_duzeyleri_en.is.null,olgunluk_duzeyleri_ar.is.null');

    if (fetchError) {
      throw fetchError;
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ message: 'Çevrilecek kayıt bulunamadı. Tüm kayıtlar zaten çevrilmiş veya boş.' });
    }

    const results = [];

    // 2. Process sequentially to avoid OpenAI rate limits and DB overwhelming
    for (const record of records) {
      const trData = record.olgunluk_duzeyleri;
      
      // Validasyon: Sadece geçerli objeleri işle
      if (!trData || typeof trData !== 'object' || Object.keys(trData).length === 0) {
        results.push({ id: record.id, status: 'skipped', reason: 'Invalid or empty JSONB object' });
        continue;
      }

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Sen bir YÖKAK ve İAA akademik akreditasyon uzmanı ve yeminli tercümansın. Sana verilen Türkçe JSON objesindeki değerleri (value) akademik ve resmi bir dille İngilizceye ve Arapçaya çevir. JSON formatını ve anahtarları (1, 2, 3, 4, 5) ASLA bozma. Sadece şu formatta bir JSON döndür: {"en": {"1": "...", "5": "..."}, "ar": {"1": "...", "5": "..."}}'
            },
            {
              role: 'user',
              content: JSON.stringify(trData)
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1, // Strict determinism
        });

        const replyContent = response.choices[0].message.content;
        if (!replyContent) throw new Error('OpenAI returned empty content');

        const translatedData = JSON.parse(replyContent);

        if (!translatedData.en || !translatedData.ar) {
             throw new Error('Geçersiz JSON yapısı döndü (en veya ar objesi eksik)');
        }

        // 3. Update the database
        const { error: updateError } = await supabase
          .from('alt_olcutler')
          .update({
            olgunluk_duzeyleri_en: translatedData.en,
            olgunluk_duzeyleri_ar: translatedData.ar,
          })
          .eq('id', record.id);

        if (updateError) {
          throw updateError;
        }

        results.push({ id: record.id, status: 'success' });
        
      } catch (err: any) {
         console.error(`ID ${record.id} çeviri hatası:`, err);
         results.push({ id: record.id, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({
      message: 'Çeviri işlemi tamamlandı',
      total_processed: records.length,
      success_count: results.filter(r => r.status === 'success').length,
      results
    });

  } catch (error: any) {
    console.error('Translation process root error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
