import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
    const { id, email, ad_soyad } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration error');
    }

    // Admin client to bypass RLS for inserting the profile
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Güvenlik Doğrulaması: Kullanıcının gerçekten Supabase Auth sisteminde kayıtlı olduğunu doğrula
    let isAuthorized = false;

    // 1. Önce Admin API ile kullanıcı varlığını doğrula (E-posta doğrulama aktif olsa dahi çalışır)
    const { data: adminUserData } = await supabaseAdmin.auth.admin.getUserById(id);
    if (adminUserData?.user && adminUserData.user.email === email) {
      isAuthorized = true;
    } else {
      // 2. Çerez bazlı oturum kontrolü (Yedek kontrol)
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {}
        }
      });
      const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
      if (authUser && authUser.id === id && authUser.email === email) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized profile sync attempt' }, { status: 403 });
    }

    // Önceden oluşturulmuş profil kaydı var mı kontrol et
    const { data: existingProfile } = await supabaseAdmin
      .from('profiller')
      .select('rol, ad_soyad, olusturulma_tarihi')
      .eq('email', email)
      .maybeSingle();

    let targetRol = (email && (email.endsWith('@harran.edu.tr') || email.includes('harran.edu.tr'))) ? 'OgretimElemani' : 'Beklemede';
    let targetAdSoyad = ad_soyad;

    if (existingProfile) {
      // Eğer profil tetikleyici (trigger) tarafından milisaniyeler önce oluşturulduysa
      // bu yeni bir kayıttır ve rolü Beklemede (veya Harran için OgretimElemani) olmalıdır.
      // Eğer profil daha önceden oluşturulmuşsa (örneğin 15 saniyeden daha eski),
      // o zaman yöneticinin verdiği rolü (BirimSorumlusu, Yonetici vb.) koruruz.
      const now = new Date();
      const profileCreatedAt = new Date(existingProfile.olusturulma_tarihi || now);
      const diffInSeconds = Math.abs(now.getTime() - profileCreatedAt.getTime()) / 1000;

      if (diffInSeconds > 15) {
        targetRol = existingProfile.rol || 'BirimSorumlusu';
        targetAdSoyad = existingProfile.ad_soyad || ad_soyad;
      }
    }

    const { error } = await supabaseAdmin
      .from('profiller')
      .upsert({
        id,
        email,
        ad_soyad: targetAdSoyad,
        rol: targetRol
      });

    if (error) {
      console.error('Database Sync Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
