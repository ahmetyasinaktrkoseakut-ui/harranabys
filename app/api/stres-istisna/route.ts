import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { buildIstisnaAnahtari, StresIstisnaKaydi } from '@/lib/stresIstisnaService';
import { getAssignedLetter } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Sunucu Supabase yapılandırması eksik.' }, { status: 500 });
    }

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

    const { searchParams } = new URL(request.url);
    const donemId = searchParams.get('donem_id');
    const altOlcutId = searchParams.get('alt_olcut_id');

    if (!donemId) {
      return NextResponse.json({ error: 'donem_id parametresi zorunludur.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Kullanıcı rolünü kontrol et
    const { data: profile } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.rol?.toLowerCase() || '';
    const isAdmin = role.includes('admin') || role.includes('yonetici') || role.includes('yönetici');
    const isObserver = role.includes('gozlemci') || role.includes('gözlemci');

    // Eğer admin veya gözlemci değilse yetki sınırlandırması uygula
    let allowedOlcutIds: Set<string> | null = null;

    if (!isAdmin && !isObserver) {
      // 1. Kullanıcının bu dönem için doğrudan atandığı ölçütler:
      const { data: userAssignments } = await supabaseAdmin
        .from('kullanici_olcut_atamalari')
        .select('alt_olcut_id')
        .eq('user_id', user.id)
        .eq('donem_id', String(donemId));

      const assignedIds = new Set<string>(
        (userAssignments || []).map(a => String(a.alt_olcut_id))
      );

      // 2. Başlık koordinatörlüğü harfleri:
      const { data: coordData } = await supabaseAdmin
        .from('baslik_koordinatorleri')
        .select('baslik')
        .eq('kullanici_id', user.id);

      const assignedLetters = (coordData || [])
        .map(c => getAssignedLetter(c.baslik))
        .filter(Boolean);

      if (assignedLetters.length > 0) {
        const { data: allOlcutler } = await supabaseAdmin
          .from('alt_olcutler')
          .select('id, kod');

        (allOlcutler || []).forEach(o => {
          if (assignedLetters.some(letter => o.kod.startsWith(letter))) {
            assignedIds.add(String(o.id));
          }
        });
      }

      allowedOlcutIds = assignedIds;

      // Eğer belirli bir ölçüt sorgulanıyorsa ve yetki yoksa 403 dön
      if (altOlcutId && !allowedOlcutIds.has(String(altOlcutId))) {
        return NextResponse.json(
          { error: 'Bu ölçütün istisnalarını görüntüleme yetkiniz bulunmamaktadır.' },
          { status: 403 }
        );
      }

      // Yetkili olunan hiçbir ölçüt yoksa boş liste dön
      if (allowedOlcutIds.size === 0) {
        return NextResponse.json({ data: [] });
      }
    }

    let query = supabaseAdmin
      .from('system_islem_loglari')
      .select('user_id, islem_tipi, kayit_id, yeni_veri, tarih')
      .eq('islem_tipi', 'STRES_ISTISNA')
      .order('tarih', { ascending: true });

    if (altOlcutId) {
      query = query.eq('kayit_id', String(altOlcutId));
    } else if (allowedOlcutIds) {
      query = query.in('kayit_id', Array.from(allowedOlcutIds));
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const istisnaMap = new Map<string, StresIstisnaKaydi>();

    (data || []).forEach(row => {
      const payload = row.yeni_veri;
      if (payload && String(payload.donem_id) === String(donemId) && payload.istisna_anahtari) {
        // Ek güvenlik: Eğer hoca sadece izinli ölçütleri görebiliyorsa kontrol et
        if (allowedOlcutIds && !allowedOlcutIds.has(String(payload.alt_olcut_id))) {
          return;
        }

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

    return NextResponse.json({ data: Array.from(istisnaMap.values()) });
  } catch (err: any) {
    console.error('GET /api/stres-istisna error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Sunucu Supabase yapılandırması eksik.' }, { status: 500 });
    }

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

    const body = await request.json().catch(() => ({}));
    const { donem_id, alt_olcut_id, sorun_tipi, kanit_kimligi, aktif, gerekce } = body;

    if (!donem_id || !alt_olcut_id || !sorun_tipi) {
      return NextResponse.json({ error: 'donem_id, alt_olcut_id ve sorun_tipi zorunludur.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Kullanıcı rol kontrolü
    const { data: profile } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.rol?.toLowerCase() || '';
    const isAdmin = role.includes('admin') || role.includes('yonetici') || role.includes('yönetici');
    const isObserver = role.includes('gozlemci') || role.includes('gözlemci');

    // Eğer admin veya observer değilse, bu ölçüte ve döneme atanmış mı veya koordinatör mü kontrol et
    if (!isAdmin && !isObserver) {
      const { count: assignmentCount } = await supabaseAdmin
        .from('kullanici_olcut_atamalari')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('alt_olcut_id', String(alt_olcut_id))
        .eq('donem_id', String(donem_id));

      let isCoordinator = false;
      const { data: currentOlcut } = await supabaseAdmin
        .from('alt_olcutler')
        .select('kod')
        .eq('id', alt_olcut_id)
        .maybeSingle();

      if (currentOlcut?.kod) {
        const { data: coordData } = await supabaseAdmin
          .from('baslik_koordinatorleri')
          .select('baslik')
          .eq('kullanici_id', user.id);

        const assignedLetters = (coordData || [])
          .map(c => getAssignedLetter(c.baslik))
          .filter(Boolean);

        if (assignedLetters.some(letter => currentOlcut.kod.startsWith(letter))) {
          isCoordinator = true;
        }
      }

      if ((assignmentCount || 0) === 0 && !isCoordinator) {
        return NextResponse.json(
          { error: 'Bu ölçüt ve dönem üzerinde işlem yapma yetkiniz bulunmamaktadır.' },
          { status: 403 }
        );
      }
    }

    const anahtar = buildIstisnaAnahtari({
      donemId: donem_id,
      altOlcutId: alt_olcut_id,
      sorunTipi: sorun_tipi,
      kanitKimligi: kanit_kimligi,
    });

    const recordPayload: StresIstisnaKaydi = {
      donem_id: String(donem_id),
      alt_olcut_id: String(alt_olcut_id),
      sorun_tipi,
      kanit_kimligi: kanitKimligiClean(kanit_kimligi),
      istisna_anahtari: anahtar,
      aktif: Boolean(aktif),
      gerekce: gerekce || '',
      kullanici_id: user.id,
    };

    const { error: insertError } = await supabaseAdmin.from('system_islem_loglari').insert({
      user_id: user.id,
      islem_tipi: 'STRES_ISTISNA',
      tablo_adi: 'ozdegerlendirme_raporlari',
      kayit_id: String(alt_olcut_id),
      yeni_veri: recordPayload,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: recordPayload });
  } catch (err: any) {
    console.error('POST /api/stres-istisna error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function kanitKimligiClean(str?: string | null): string {
  return str || 'genel';
}
