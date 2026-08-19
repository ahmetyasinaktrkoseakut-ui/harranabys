import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured' }, { status: 500 });
    }

    // Parse request body
    const { baslik, icerik } = await request.json();
    if (!baslik?.trim() || !icerik?.trim()) {
      return NextResponse.json({ error: 'Baslik and icerik are required' }, { status: 400 });
    }

    // Güvenlik Yaması: API'yi çağıran kişinin gerçekten Yönetici/Admin olup olmadığını kontrol et.
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

    // Yetki onaylandı, şimdi servis rolünü kullanarak duyuruyu ekle
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabaseAdmin
      .from('duyurular')
      .insert({
        baslik: baslik.trim(),
        icerik: icerik.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Database announcement insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Announcement creation process root error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
