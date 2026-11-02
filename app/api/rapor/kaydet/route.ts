import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Sunucu Supabase yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Oturum Kontrolü (Caller Authentication)
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapınız.' }, { status: 401 });
    }

    // 2. Girdi Doğrulaması
    const body = await request.json().catch(() => ({}));
    const { alt_olcut_id, donem_id, icerik, icerik_en, kanitlar } = body;

    if (!alt_olcut_id || !donem_id) {
      return NextResponse.json({ error: 'alt_olcut_id ve donem_id zorunludur.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Kullanıcı Yetki Kontrolü
    const { data: profile } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    const userRole = (profile?.rol ?? '').toLowerCase();
    const isAdmin =
      userRole.includes('yönetici') ||
      userRole.includes('yonetici') ||
      userRole.includes('admin');

    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      // Birim sorumlusu atama kontrolü
      const { count: assignmentCount } = await supabaseAdmin
        .from('kullanici_olcut_atamalari')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('alt_olcut_id', Number(alt_olcut_id));

      if ((assignmentCount || 0) > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Başlık koordinatörü kontrolü
      const { data: altOlcut } = await supabaseAdmin
        .from('alt_olcutler')
        .select('kod')
        .eq('id', Number(alt_olcut_id))
        .maybeSingle();

      if (altOlcut?.kod) {
        const { data: coordData } = await supabaseAdmin
          .from('baslik_koordinatorleri')
          .select('baslik')
          .eq('kullanici_id', user.id);

        if (coordData && coordData.length > 0) {
          const letter = altOlcut.kod.charAt(0).toUpperCase();
          const titleMap: Record<string, string> = {
            'A': 'Kalite Güvencesi',
            'B': 'Eğitim-Öğretim',
            'C': 'Araştırma ve Geliştirme',
            'D': 'Toplumsal Katkı',
            'E': 'Yönetim Sistemi'
          };
          const matchedTitle = titleMap[letter];
          if (coordData.some(c => c.baslik === matchedTitle || c.baslik?.toLowerCase()?.includes(matchedTitle?.toLowerCase()))) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Bu ölçüte rapor kaydetme yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    const upsertData = {
      alt_olcut_id: String(alt_olcut_id),
      donem_id: String(donem_id),
      icerik: icerik ?? '',
      icerik_en: icerik_en ?? '',
      kanitlar: Array.isArray(kanitlar) ? kanitlar : [],
      onay_durumu: 'bekliyor',
      red_nedeni: null,
      kullanici_id: user.id
    };

    // 4. Var olan kaydı kontrol et
    const { data: existingRecord } = await supabaseAdmin
      .from('ozdegerlendirme_raporlari')
      .select('id')
      .eq('alt_olcut_id', String(alt_olcut_id))
      .eq('donem_id', String(donem_id))
      .order('olusturulma_tarihi', { ascending: false })
      .limit(1)
      .maybeSingle();

    let resultRecord = null;
    if (existingRecord?.id) {
      const { data, error } = await supabaseAdmin
        .from('ozdegerlendirme_raporlari')
        .update(upsertData)
        .eq('id', existingRecord.id)
        .select()
        .single();
      if (error) throw error;
      resultRecord = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('ozdegerlendirme_raporlari')
        .insert(upsertData)
        .select()
        .single();
      if (error) throw error;
      resultRecord = data;
    }

    return NextResponse.json({ success: true, data: resultRecord });
  } catch (error: any) {
    console.error('Save report API error:', error);
    return NextResponse.json({ error: error.message || 'Rapor kaydedilirken bir hata oluştu.' }, { status: 500 });
  }
}
