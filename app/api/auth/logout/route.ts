import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      });

      // Supabase oturumunu sunucu tarafında sonlandır
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error on server:', err);
      }
    }

    const response = NextResponse.json({ success: true, message: 'Oturum kapatildi.' });

    // sb-* ve auth-token içeren tüm oturum çerezlerini kesin olarak temizle
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      if (
        cookie.name.startsWith('sb-') ||
        cookie.name.includes('auth-token') ||
        cookie.name.includes('supabase')
      ) {
        try {
          cookieStore.set(cookie.name, '', {
            path: '/',
            maxAge: 0,
            expires: new Date(0),
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          });
        } catch (_) {}

        response.cookies.set(cookie.name, '', {
          path: '/',
          maxAge: 0,
          expires: new Date(0),
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        });
      }
    }

    return response;
  } catch (error: any) {
    console.error('Logout route error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
