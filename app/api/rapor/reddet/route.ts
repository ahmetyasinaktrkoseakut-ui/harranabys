import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const TOPIC_MAPPING: Record<string, { code: string; fullName: string }> = {
  'kalite güvencesi': { code: 'A', fullName: 'KALİTE GÜVENCESİ SİSTEMİ' },
  'kalite guvencesi': { code: 'A', fullName: 'KALİTE GÜVENCESİ SİSTEMİ' },
  'eğitim-öğretim': { code: 'B', fullName: 'EĞİTİM VE ÖĞRETİM' },
  'egitim-ogretim': { code: 'B', fullName: 'EĞİTİM VE ÖĞRETİM' },
  'araştırma ve geliştirme': { code: 'C', fullName: 'ARAŞTIRMA VE GELİŞTİRME' },
  'arastirma ve gelistirme': { code: 'C', fullName: 'ARAŞTIRMA VE GELİŞTİRME' },
  'toplumsal katkı': { code: 'D', fullName: 'TOPLUMSAL KATKI' },
  'toplumsal katki': { code: 'D', fullName: 'TOPLUMSAL KATKI' },
  'yönetim sistemi': { code: 'E', fullName: 'YÖNETİM SİSTEMİ' },
  'yonetim sistemi': { code: 'E', fullName: 'YÖNETİM SİSTEMİ' },
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Sunucu Supabase yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Oturum Kontrolü (Cookie tabanlı sunucu doğrulaması)
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

    // 2. Girdi Doğrulaması (İstemciden YALNIZCA raporId ve redNedeni kabul edilir)
    const body = await request.json().catch(() => ({}));
    const { raporId, redNedeni } = body;

    if (!raporId || typeof raporId !== 'string') {
      return NextResponse.json({ error: 'Geçerli bir raporId zorunludur.' }, { status: 400 });
    }

    const trimmedReason = (redNedeni || '').trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 1000) {
      return NextResponse.json(
        { error: 'Ret gerekçesi en az 5, en fazla 1000 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Raporun Varlığını ve Bağlı Bilgilerini Sunucuda Çekme
    const { data: report, error: reportFetchError } = await supabaseAdmin
      .from('ozdegerlendirme_raporlari')
      .select('id, alt_olcut_id, donem_id, onay_durumu')
      .eq('id', raporId)
      .maybeSingle();

    if (reportFetchError || !report) {
      return NextResponse.json({ error: 'Belirtilen rapor bulunamadı.' }, { status: 404 });
    }

    // 4. Aktif Dönem Doğrulaması (Yalnızca aktif dönem raporları reddedilebilir)
    const { data: period, error: periodError } = await supabaseAdmin
      .from('donemler')
      .select('id, is_active')
      .eq('id', report.donem_id)
      .maybeSingle();

    if (periodError || !period || !period.is_active) {
      return NextResponse.json({ error: 'Yalnızca aktif döneme ait raporlar üzerinde işlem yapılabilir.' }, { status: 400 });
    }

    // 5. Yetki Doğrulaması (Admin mi / İlgili Ana Başlığın Koordinatörü mü?)
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
      // Ölçüt ve Ana Başlık ilişkisini çek
      const { data: altOlcut } = await supabaseAdmin
        .from('alt_olcutler')
        .select('id, kod, ana_baslik_id')
        .eq('id', report.alt_olcut_id)
        .maybeSingle();

      if (altOlcut?.ana_baslik_id) {
        const { data: anaBaslik } = await supabaseAdmin
          .from('ana_basliklar')
          .select('id, kod, baslik_adi')
          .eq('id', altOlcut.ana_baslik_id)
          .maybeSingle();

        if (anaBaslik) {
          const { data: coordAssignments } = await supabaseAdmin
            .from('baslik_koordinatorleri')
            .select('baslik')
            .eq('kullanici_id', user.id);

          if (coordAssignments && coordAssignments.length > 0) {
            const targetCode = (anaBaslik.kod || '').trim().toUpperCase();
            const targetTitle = (anaBaslik.baslik_adi || '').trim().toLocaleUpperCase('tr');

            isAuthorized = coordAssignments.some((ca: any) => {
              const coordTitleRaw = (ca.baslik || '').trim();
              const coordTitleUpper = coordTitleRaw.toLocaleUpperCase('tr');
              const coordTitleLower = coordTitleRaw.toLocaleLowerCase('tr');

              // 1. Kod eşitliği ('A' === 'A')
              if (coordTitleUpper === targetCode) return true;
              // 2. Tam başlık eşitliği ('KALİTE GÜVENCESİ SİSTEMİ')
              if (coordTitleUpper === targetTitle) return true;
              // 3. Standart başlık eşleşmesi ('Kalite Güvencesi' -> 'KALİTE GÜVENCESİ SİSTEMİ' / 'A')
              const mapped = TOPIC_MAPPING[coordTitleLower];
              if (mapped && (mapped.code === targetCode || mapped.fullName === targetTitle)) {
                return true;
              }
              return false;
            });
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Bu ölçüt üzerinde ret yetkiniz bulunmamaktadır.' },
        { status: 403 }
      );
    }

    // 6. Atomik Veritabanı Fonksiyonunu Çalıştırma (p_gonderen_id oturum kullanıcısıdır)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('rapor_reddet_atomic', {
      p_rapor_id: raporId,
      p_red_nedeni: trimmedReason,
      p_gonderen_id: user.id,
    });

    // KESİN KURAL: RPC hata verirse KESİNLİKLE fallback çalıştırılmaz; işlem 500 ile durdurulur.
    if (rpcError) {
      console.error('[REJECT ROUTE] RPC çalıştırma hatası:', rpcError);
      return NextResponse.json(
        { error: 'Veritabanı atomik ret işlemi başarısız oldu: ' + (rpcError.message || 'RPC hatası') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      duplicate: rpcResult?.duplicate ?? false,
      message: rpcResult?.message,
    });
  } catch (error: any) {
    console.error('[REJECT ROUTE] Beklenmeyen hata:', error);
    return NextResponse.json(
      { error: error?.message || 'İşlem sırasında beklenmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}
