import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bucket: string; path: string[] }> }
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

    // 2. Admin servisi ile dosyayi guvenli sekilde stream et
    const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(decodeURIComponent(filePath));

    if (downloadError || !fileBlob) {
      return NextResponse.json({ error: 'Dosya bulunamadi.' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', fileBlob.type || 'application/octet-stream');
    headers.set('Content-Length', fileBlob.size.toString());
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('Content-Disposition', 'inline');

    return new NextResponse(fileBlob, {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error('Storage stream error:', error);
    return NextResponse.json({ error: 'Dosya sunucu hatasi.' }, { status: 500 });
  }
}
