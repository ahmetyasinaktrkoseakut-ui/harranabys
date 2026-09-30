import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const TOPIC_LETTER_MAP: Record<string, string> = {
  'kalite güvencesi': 'A',
  'kalite guvencesi': 'A',
  'eğitim-öğretim': 'B',
  'egitim-ogretim': 'B',
  'araştırma ve geliştirme': 'C',
  'arastirma ve gelistirme': 'C',
  'toplumsal katkı': 'D',
  'toplumsal katki': 'D',
  'yönetim sistemi': 'E',
  'yonetim sistemi': 'E',
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Sunucu Oturum Kontrolü
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
      return NextResponse.json({ error: 'Yetkisiz erişim. Oturum bulunamadı.' }, { status: 401 });
    }

    const { faaliyetId } = await request.json().catch(() => ({}));
    if (!faaliyetId || typeof faaliyetId !== 'string') {
      return NextResponse.json({ error: 'Geçerli bir faaliyetId zorunludur.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Faaliyetin Varlığını Çek
    const { data: faaliyet, error: fetchErr } = await supabaseAdmin
      .from('dis_faaliyet_kanitlari')
      .select('id, alt_olcut_id, donem_id, durum')
      .eq('id', faaliyetId)
      .maybeSingle();

    if (fetchErr || !faaliyet) {
      return NextResponse.json({ error: 'Belirtilen faaliyet kaydı bulunamadı.' }, { status: 404 });
    }

    if (faaliyet.durum !== 'beklemede') {
      return NextResponse.json({ error: `Bu faaliyet zaten işleme alınmış (Durum: ${faaliyet.durum}).` }, { status: 400 });
    }

    // 3. Yetki Doğrulaması
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
      const { data: atama } = await supabaseAdmin
        .from('kullanici_olcut_atamalari')
        .select('id')
        .eq('alt_olcut_id', faaliyet.alt_olcut_id)
        .eq('donem_id', faaliyet.donem_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (atama) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const { data: altOlcut } = await supabaseAdmin
        .from('alt_olcutler')
        .select('kod')
        .eq('id', faaliyet.alt_olcut_id)
        .maybeSingle();

      if (altOlcut?.kod) {
        const { data: coordData } = await supabaseAdmin
          .from('baslik_koordinatorleri')
          .select('baslik')
          .eq('kullanici_id', user.id);

        if (coordData && coordData.length > 0) {
          const targetCode = altOlcut.kod.trim().toUpperCase();
          isAuthorized = coordData.some((ca: any) => {
            const raw = (ca.baslik || '').trim().toLowerCase();
            const letter = TOPIC_LETTER_MAP[raw] || raw.charAt(0).toUpperCase();
            return letter && targetCode.startsWith(letter);
          });
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Bu faaliyeti reddetme yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    // 4. Atomik RPC Fonksiyonunu Çalıştır
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('faaliyet_kaniti_reddet_atomic', {
      p_faaliyet_id: faaliyetId,
      p_kullanici_id: user.id,
    });

    if (rpcError) {
      console.error('[FAALIYET REDDET RPC] Hata:', rpcError);
      return NextResponse.json({ error: 'Reddetme işlemi başarısız: ' + (rpcError.message || '') }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[FAALIYET REDDET] Hata:', error);
    return NextResponse.json({ error: error?.message || 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
