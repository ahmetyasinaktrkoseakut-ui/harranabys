import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { sendBatchEmails, createAnnouncementEmailHtml } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Oturum Doğrulaması
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

    // 2. Rol ve Yetki Kontrolü
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

    const { data: coordRecords } = await supabaseAdmin
      .from('baslik_koordinatorleri')
      .select('baslik')
      .eq('kullanici_id', user.id);

    const isCoordinator = (coordRecords && coordRecords.length > 0) || false;

    if (!isAdmin && !isCoordinator) {
      return NextResponse.json(
        { error: 'Yetersiz yetki. Yalnızca Yönetici veya Koordinatörler e-posta gönderebilir.' },
        { status: 403 }
      );
    }

    // 3. Gönderim Parametreleri
    const body = await request.json().catch(() => ({}));
    const { baslik, icerik, targetType, targetId } = body;

    const trimmedBaslik = (baslik || '').trim();
    const trimmedIcerik = (icerik || '').trim();

    if (!trimmedBaslik || !trimmedIcerik) {
      return NextResponse.json({ error: 'Başlık ve içerik alanları zorunludur.' }, { status: 400 });
    }

    let targetEmails: { email: string; ad_soyad?: string }[] = [];

    // Tüm Fakülte (Yalnızca Yönetici)
    if (targetType === 'all') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Tüm fakülteye e-posta gönderme yetkisi yalnızca yöneticilerdedir.' }, { status: 403 });
      }

      const { data: users } = await supabaseAdmin
        .from('profiller')
        .select('email, ad_soyad')
        .neq('rol', 'Beklemede')
        .not('email', 'is', null);

      targetEmails = (users || [])
        .filter(u => u.email && u.email.includes('@'))
        .map(u => ({ email: u.email, ad_soyad: u.ad_soyad }));
    }
    // Tek Bir Öğretim Elemanı
    else if (targetType === 'user' && targetId) {
      const { data: targetUser } = await supabaseAdmin
        .from('profiller')
        .select('email, ad_soyad')
        .eq('id', targetId)
        .maybeSingle();

      if (targetUser?.email && targetUser.email.includes('@')) {
        targetEmails = [{ email: targetUser.email, ad_soyad: targetUser.ad_soyad }];
      }
    }
    // Belirli Bir Ana Başlığa / Komisyona Atanmış Hocalar
    else if (targetType === 'heading' && targetId) {
      const { data: altOlcutler } = await supabaseAdmin
        .from('alt_olcutler')
        .select('id')
        .eq('ana_baslik_id', targetId);

      const altOlcutIds = (altOlcutler || []).map(a => a.id);

      if (altOlcutIds.length > 0) {
        const { data: activePeriod } = await supabaseAdmin
          .from('donemler')
          .select('id')
          .eq('is_active', true)
          .maybeSingle();

        if (activePeriod) {
          const { data: atamalar } = await supabaseAdmin
            .from('kullanici_olcut_atamalari')
            .select('user_id')
            .in('alt_olcut_id', altOlcutIds)
            .eq('donem_id', activePeriod.id);

          const userIds = Array.from(new Set((atamalar || []).map(a => a.user_id).filter(Boolean)));

          if (userIds.length > 0) {
            const { data: profs } = await supabaseAdmin
              .from('profiller')
              .select('email, ad_soyad')
              .in('id', userIds)
              .not('email', 'is', null);

            targetEmails = (profs || [])
              .filter(p => p.email && p.email.includes('@'))
              .map(p => ({ email: p.email, ad_soyad: p.ad_soyad }));
          }
        }
      }
    }

    if (targetEmails.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Yetki kapsamınızda gönderilecek kayıtlı e-posta bulunamadı.',
      });
    }

    const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const html = createAnnouncementEmailHtml({
      baslik: trimmedBaslik,
      icerik: trimmedIcerik,
      appUrl,
    });

    const subject = `[Harran ABYS Duyuru] ${trimmedBaslik}`;
    const batchItems = targetEmails.map(t => ({
      to: t.email.trim(),
      subject,
      html,
    }));

    const result = await sendBatchEmails(batchItems);

    return NextResponse.json({
      success: result.success,
      count: result.count,
      totalTarget: batchItems.length,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[EMAIL ROUTE] Hata:', error);
    return NextResponse.json({ error: error?.message || 'E-posta gönderiminde beklenmeyen hata.' }, { status: 500 });
  }
}
