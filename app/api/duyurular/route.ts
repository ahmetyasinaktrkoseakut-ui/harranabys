import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sendBatchEmails, createAnnouncementEmailHtml } from '@/lib/email';

function getHeadingLetter(titleOrLetter: string): string {
  const t = (titleOrLetter || '').trim().toLowerCase();
  if (t === 'a' || t.startsWith('kalite')) return 'A';
  if (t === 'b' || t.startsWith('eğitim') || t.startsWith('egitim')) return 'B';
  if (t === 'c' || t.startsWith('araştırma') || t.startsWith('arastirma')) return 'C';
  if (t === 'd' || t.startsWith('toplumsal')) return 'D';
  if (t === 'e' || t.startsWith('yönetim') || t.startsWith('yonetim')) return 'E';
  return (titleOrLetter || '').charAt(0).toUpperCase();
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured' }, { status: 500 });
    }

    // 1. Oturum Kontrolü
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Rol ve Yetki Kontrolü
    const { data: profile } = await supabaseAdmin.from('profiller').select('rol').eq('id', user.id).single();
    const userRole = (profile?.rol ?? '').toLowerCase();
    const isAdmin = userRole.includes('yönetici') || userRole.includes('admin') || userRole.includes('yonetici');

    const { data: coordRecords } = await supabaseAdmin
      .from('baslik_koordinatorleri')
      .select('baslik')
      .eq('kullanici_id', user.id);

    const isCoordinator = (coordRecords && coordRecords.length > 0) || false;
    const coordinatorLetters = (coordRecords || []).map((c: any) => getHeadingLetter(c.baslik));

    if (!isAdmin && !isCoordinator) {
      return NextResponse.json(
        { error: 'Yetersiz yetki. Duyuru oluşturma Yönetici veya Koordinatörlere açıktır.' },
        { status: 403 }
      );
    }

    // 3. Girdi Doğrulama
    const body = await request.json().catch(() => ({}));
    const {
      baslik,
      icerik,
      sendEmail = false,
      hedefKitle = 'tum', // 'tum' | 'baslik' | 'hoca'
      hedefBaslikKod,    // e.g. 'A', 'B', 'C', 'D', 'E'
      hedefHocaId,       // UUID
    } = body;

    const trimmedBaslik = (baslik || '').trim();
    const trimmedIcerik = (icerik || '').trim();

    if (!trimmedBaslik || !trimmedIcerik) {
      return NextResponse.json({ error: 'Başlık ve içerik zorunludur.' }, { status: 400 });
    }

    // Koordinatör kapsam sınırlamaları
    if (!isAdmin && isCoordinator) {
      if (hedefKitle === 'tum') {
        return NextResponse.json(
          { error: 'Koordinatörler tüm fakülteye duyuru gönderemez. Yalnızca kendi başlığına veya o başlıktaki hocalara duyuru gönderebilir.' },
          { status: 403 }
        );
      }
      if (hedefKitle === 'baslik') {
        const cleanBaslikKod = (hedefBaslikKod || '').toUpperCase().trim();
        if (!coordinatorLetters.includes(cleanBaslikKod)) {
          return NextResponse.json(
            { error: 'Yalnızca koordinatörü olduğunuz başlığa duyuru gönderebilirsiniz.' },
            { status: 403 }
          );
        }
      }
    }

    // 4. Aktif Dönem
    const { data: activePeriod } = await supabaseAdmin
      .from('donemler')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    // 5. Hedef Alıcıları Belirleme
    let targetInstructors: { id: string; email: string; ad_soyad: string }[] = [];

    if (hedefKitle === 'hoca' && hedefHocaId) {
      const { data: hocaProf } = await supabaseAdmin
        .from('profiller')
        .select('id, ad_soyad, email')
        .eq('id', hedefHocaId)
        .maybeSingle();

      if (hocaProf?.email && hocaProf.email.includes('@')) {
        targetInstructors = [{ id: hocaProf.id, email: hocaProf.email, ad_soyad: hocaProf.ad_soyad || 'Öğretim Elemanı' }];
      }
    } else if (hedefKitle === 'baslik' && hedefBaslikKod) {
      const cleanBaslikKod = hedefBaslikKod.toUpperCase().trim();

      // İlgili ana başlığın altındaki alt ölçütleri bul
      const { data: altOlcutler } = await supabaseAdmin
        .from('alt_olcutler')
        .select('id, kod');

      const matchingIds = (altOlcutler || [])
        .filter(o => (o.kod || '').toUpperCase().startsWith(`${cleanBaslikKod}.`))
        .map(o => o.id);

      if (matchingIds.length > 0 && activePeriod?.id) {
        const { data: atamalar } = await supabaseAdmin
          .from('kullanici_olcut_atamalari')
          .select('user_id')
          .in('alt_olcut_id', matchingIds)
          .eq('donem_id', activePeriod.id);

        const userIds = Array.from(new Set((atamalar || []).map(a => a.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const { data: profs } = await supabaseAdmin
            .from('profiller')
            .select('id, ad_soyad, email')
            .in('id', userIds)
            .not('email', 'is', null);

          targetInstructors = (profs || [])
            .filter(p => p.email && p.email.includes('@'))
            .map(p => ({ id: p.id, email: p.email, ad_soyad: p.ad_soyad || 'Öğretim Elemanı' }));
        }
      }
    } else if (hedefKitle === 'tum' && isAdmin) {
      const { data: allProf } = await supabaseAdmin
        .from('profiller')
        .select('id, ad_soyad, email')
        .neq('rol', 'Beklemede')
        .not('email', 'is', null);

      targetInstructors = (allProf || [])
        .filter(p => p.email && p.email.includes('@'))
        .map(p => ({ id: p.id, email: p.email, ad_soyad: p.ad_soyad || 'Öğretim Elemanı' }));
    }

    // 6. Kayıt Yönetimi
    let announcementData = null;

    if (hedefKitle === 'tum') {
      const { data, error } = await supabaseAdmin
        .from('duyurular')
        .insert({
          baslik: trimmedBaslik,
          icerik: trimmedIcerik,
        })
        .select()
        .single();

      if (error) {
        console.error('Database announcement insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      announcementData = data;
    } else {
      // Kişiye veya gruba özel mesaj: bildirimler tablosuna ilgili hocalar için özel bildirim eklenir
      const targetUserIds = targetInstructors.map(t => t.id).filter(Boolean);
      if (targetUserIds.length > 0) {
        try {
          const notifInserts = targetUserIds.map(uid => ({
            gonderen_id: user.id,
            alici_id: uid,
            mesaj: `${trimmedBaslik}: ${trimmedIcerik}`,
            tip: 'duyuru',
            okundu: false,
          }));
          await supabaseAdmin.from('bildirimler').insert(notifInserts);
        } catch (notifErr: any) {
          console.warn('[NOTIF INSERT WARN]:', notifErr?.message || notifErr);
        }
      }
    }

    // 7. E-Posta Bildirimi
    let isEmailSent = false;
    if (sendEmail === true && targetInstructors.length > 0) {
      try {
        const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const html = createAnnouncementEmailHtml({
          baslik: trimmedBaslik,
          icerik: trimmedIcerik,
          appUrl,
        });

        const subject = `[Harran ABYS Duyuru] ${trimmedBaslik}`;
        const batchItems = targetInstructors.map(ins => ({
          to: ins.email.trim(),
          subject,
          html,
        }));

        const result = await sendBatchEmails(batchItems);
        isEmailSent = result.success;
      } catch (emailErr) {
        console.warn('[ANNOUNCEMENT EMAIL] E-posta tetikleme adımı atlandı/hata:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: announcementData,
      recipientCount: targetInstructors.length,
      emailSent: isEmailSent,
      isPrivate: hedefKitle !== 'tum',
    });

  } catch (error: any) {
    console.error('Announcement creation process root error:', error);
    return NextResponse.json({ error: error?.message || 'Beklenmeyen hata oluştu' }, { status: 500 });
  }
}
