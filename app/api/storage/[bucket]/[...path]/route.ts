import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function handleStorageProxy(
  request: NextRequest,
  context: { params: Promise<{ bucket: string; path: string[] }> },
  isHead: boolean
) {
  try {
    const { bucket, path } = await context.params;
    const filePath = path.join('/');

    if (!bucket || !filePath) {
      return NextResponse.json({ error: 'Gecersiz dosya yolu.' }, { status: 400 });
    }

    // Sadece izin verilen bucket'lar
    if (bucket !== 'dokumanlar' && bucket !== 'kanit_dosyalari') {
      return NextResponse.json({ error: 'Gecersiz depolama alani.' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const cookieStore = await cookies();

    // 1. Kullanici oturumunu dogrula
    const supabaseAuth = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {}
        }
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();

    // Yetkisiz erisimi kesinlikle engelle
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erisim. Lutfen once giris yapiniz.' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 2. Kullanici rolunu ve yetkisini denetle
    const { data: profil } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .single();

    const role = (profil?.rol || '').toLowerCase();
    const isAdmin = role.includes('admin') || role.includes('yonetici') || role.includes('yönetici');
    const isObserver = role.includes('gozlemci') || role.includes('gözlemci');

    // Admin, Yonetici ve Gozlemci rollerinin tum donemlerdeki belgelere salt-okunur erisim hakki vardir
    let hasAccess = isAdmin || isObserver;
    const decodedPath = decodeURIComponent(filePath);

    if (!hasAccess) {
      // Birim Sorumlusu veya standart kullanici: dosya_yetkilendirmeleri uzerinden katı denetle
      const { data: mapping } = await supabaseAdmin
        .from('dosya_yetkilendirmeleri')
        .select('alt_olcut_id, donem_id, owner_id')
        .eq('bucket', bucket)
        .eq('storage_path', decodedPath)
        .maybeSingle();

      if (mapping) {
        if (mapping.owner_id === user.id) {
          hasAccess = true;
        } else if (mapping.donem_id && mapping.alt_olcut_id) {
          // KESİN KURAL: mapping.donem_id NULL ise birim sorumlusuna ASLA erisim verilmez!
          const { data: atamaRows } = await supabaseAdmin
            .from('kullanici_olcut_atamalari')
            .select('id')
            .eq('user_id', user.id)
            .eq('alt_olcut_id', mapping.alt_olcut_id)
            .eq('donem_id', mapping.donem_id);

          if (atamaRows && atamaRows.length > 0) {
            hasAccess = true;
          } else {
            // Baslik koordinatorlugu denetimi
            const { data: currentOlcut } = await supabaseAdmin
              .from('alt_olcutler')
              .select('kod')
              .eq('id', mapping.alt_olcut_id)
              .maybeSingle();

            if (currentOlcut?.kod) {
              const { data: coordData } = await supabaseAdmin
                .from('baslik_koordinatorleri')
                .select('baslik')
                .eq('kullanici_id', user.id);

              const assignedLetter = coordData?.[0]?.baslik ? coordData[0].baslik.trim().charAt(0).toUpperCase() : null;
              if (assignedLetter && currentOlcut.kod.startsWith(assignedLetter)) {
                hasAccess = true;
              }
            }
          }
        }
      }
      // mapping yoksa veya donem_id NULL ise birim sorumlusuna erisim verilmez (hasAccess = false)
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Bu belgeyi goruntuleme yetkiniz bulunmamaktadir.' }, { status: 403 });
    }

    // 3. Dosyayi Storage uzerinden getir
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(decodedPath);

    if (downloadError || !fileBlob) {
      return NextResponse.json({ error: 'Dosya bulunamadi.' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', fileBlob.type || 'application/octet-stream');
    headers.set('Content-Length', fileBlob.size.toString());
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('Content-Disposition', 'inline');

    // HEAD istegi icin yalnizca basliklar ve 200 status donulur
    if (isHead) {
      return new NextResponse(null, {
        status: 200,
        headers
      });
    }

    return new NextResponse(fileBlob, {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error('Storage stream/head error:', error);
    return NextResponse.json({ error: 'Dosya sunucu hatasi.' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bucket: string; path: string[] }> }
) {
  return handleStorageProxy(request, context, false);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ bucket: string; path: string[] }> }
) {
  return handleStorageProxy(request, context, true);
}
