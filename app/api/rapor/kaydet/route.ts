import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { logAction } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Sunucu Supabase yapılandırması eksik.' }, { status: 500 });
    }

    // 1. Oturum Kontrolü (Caller Authentication)
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

    // 2. Girdi Doğrulaması
    const body = await request.json().catch(() => ({}));
    const {
      alt_olcut_id,
      donem_id,
      icerik,
      icerik_en,
      kanitlar,
      birim_anket_degerlendirmesi,
      yonetici_anket_analizi,
    } = body;

    if (!alt_olcut_id || !donem_id) {
      return NextResponse.json({ error: 'alt_olcut_id ve donem_id zorunludur.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Dönem ve Kullanıcı Yetki Kontrolü
    const { data: period, error: periodError } = await supabaseAdmin
      .from('donemler')
      .select('id, is_active')
      .eq('id', String(donem_id))
      .maybeSingle();

    if (periodError || !period) {
      return NextResponse.json({ error: 'Geçerli bir dönem bulunamadı.' }, { status: 400 });
    }

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

    if (!isAdmin && !period.is_active) {
      return NextResponse.json(
        { error: 'Kapalı dönemlerde rapor kaydedilemez veya güncellenemez.' },
        { status: 403 }
      );
    }

    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      // Birim sorumlusu atama kontrolü (dönem eşleşmeli)
      const { count: assignmentCount } = await supabaseAdmin
        .from('kullanici_olcut_atamalari')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('alt_olcut_id', Number(alt_olcut_id))
        .eq('donem_id', String(donem_id));

      if ((assignmentCount || 0) > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Başlık koordinatörü kontrolü
      const { data: altOlcut } = await supabaseAdmin
        .from('alt_olcutler')
        .select('kod')
        .eq('id', Number(alt_olcut_id))
        .maybeSingle();

      if (altOlcut?.kod) {
        const { data: coordData } = await supabaseAdmin
          .from('baslik_koordinatorleri')
          .select('baslik')
          .eq('kullanici_id', user.id);

        if (coordData && coordData.length > 0) {
          const letter = altOlcut.kod.charAt(0).toUpperCase();
          const titleMap: Record<string, string> = {
            'A': 'Kalite Güvencesi',
            'B': 'Eğitim-Öğretim',
            'C': 'Araştırma ve Geliştirme',
            'D': 'Toplumsal Katkı',
            'E': 'Yönetim Sistemi'
          };
          const matchedTitle = titleMap[letter];
          if (coordData.some(c => c.baslik === matchedTitle || c.baslik?.toLowerCase()?.includes(matchedTitle?.toLowerCase()))) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Bu ölçüte rapor kaydetme yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    // 4. Var olan kaydı kontrol et
    const { data: existingRecord } = await supabaseAdmin
      .from('ozdegerlendirme_raporlari')
      .select('*')
      .eq('alt_olcut_id', String(alt_olcut_id))
      .eq('donem_id', String(donem_id))
      .order('olusturulma_tarihi', { ascending: false })
      .limit(1)
      .maybeSingle();

    let resultRecord = null;
    const isReportContentUpdated = (icerik !== undefined || icerik_en !== undefined || kanitlar !== undefined);

    if (existingRecord?.id) {
      const updatePayload: Record<string, any> = {};
      if (isReportContentUpdated) {
        updatePayload.onay_durumu = 'bekliyor';
        updatePayload.red_nedeni = null;
      }
      if (icerik !== undefined) {
        updatePayload.icerik = icerik ?? '';
      }
      if (icerik_en !== undefined) {
        updatePayload.icerik_en = icerik_en ?? '';
      }
      if (kanitlar !== undefined) {
        updatePayload.kanitlar = Array.isArray(kanitlar) ? kanitlar : [];
      }
      if (birim_anket_degerlendirmesi !== undefined) {
        updatePayload.birim_anket_degerlendirmesi = birim_anket_degerlendirmesi;
      }
      if (yonetici_anket_analizi !== undefined) {
        updatePayload.yonetici_anket_analizi = yonetici_anket_analizi;
      }

      const { data, error } = await supabaseAdmin
        .from('ozdegerlendirme_raporlari')
        .update(updatePayload)
        .eq('id', existingRecord.id)
        .select()
        .single();
      if (error) throw error;
      resultRecord = data;
    } else {
      const insertPayload: Record<string, any> = {
        alt_olcut_id: String(alt_olcut_id),
        donem_id: String(donem_id),
        icerik: icerik ?? '',
        icerik_en: icerik_en ?? '',
        kanitlar: Array.isArray(kanitlar) ? kanitlar : [],
        onay_durumu: 'bekliyor',
        red_nedeni: null,
      };
      if (birim_anket_degerlendirmesi !== undefined) {
        insertPayload.birim_anket_degerlendirmesi = birim_anket_degerlendirmesi;
      }
      if (yonetici_anket_analizi !== undefined) {
        insertPayload.yonetici_anket_analizi = yonetici_anket_analizi;
      }

      const { data, error } = await supabaseAdmin
        .from('ozdegerlendirme_raporlari')
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      resultRecord = data;
    }

    // 5. ÖDR Kaydı ise PUKÖ senkronizasyonu ve ardından işlem logu
    if (isReportContentUpdated && resultRecord?.id) {
      // Hoca veya Admin fark etmeksizin PUKÖ tablosuyla tam senkronizasyon sağla
      const { error: pErr } = await supabaseAdmin
        .from('puko_degerlendirmeleri')
        .update({ durum: 'Beklemede', red_nedeni: null })
        .eq('alt_olcut_id', Number(alt_olcut_id))
        .eq('donem_id', String(donem_id));

      if (pErr) {
        // Telafi denemesi: PUKÖ güncellenemezse ÖDR'yi eski haline döndür
        try {
          if (!existingRecord?.id) {
            // Yeni oluşturulmuş (INSERT) kayıt ise sil
            await supabaseAdmin
              .from('ozdegerlendirme_raporlari')
              .delete()
              .eq('id', resultRecord.id);
          } else {
            // Var olan (UPDATE) kayıt ise eski içerik ve onay durumuna geri döndür
            await supabaseAdmin
              .from('ozdegerlendirme_raporlari')
              .update({
                icerik: existingRecord.icerik,
                icerik_en: existingRecord.icerik_en,
                kanitlar: existingRecord.kanitlar,
                onay_durumu: existingRecord.onay_durumu,
                red_nedeni: existingRecord.red_nedeni,
                birim_anket_degerlendirmesi: existingRecord.birim_anket_degerlendirmesi,
                yonetici_anket_analizi: existingRecord.yonetici_anket_analizi,
              })
              .eq('id', existingRecord.id);
          }
        } catch (rollbackErr) {
          console.error('ÖDR telafi geri alma hatası:', rollbackErr);
        }
        throw new Error(`PUKÖ tablosu senkronize edilemedi (${pErr.message}). ÖDR değişiklikleri geri alındı.`);
      }

      // YALNIZCA İKİ GÜNCELLEME DE BAŞARILI OLDUKTAN SONRA LOGACTION ÇALIŞIR
      await logAction({
        supabase: supabaseAdmin,
        userId: user.id,
        islemTipi: existingRecord?.id ? 'UPDATE' : 'INSERT',
        tabloAdi: 'ozdegerlendirme_raporlari',
        kayitId: resultRecord.id,
        eskiVeri: existingRecord || null,
        yeniVeri: resultRecord,
      });
    }

    return NextResponse.json({ success: true, data: resultRecord });
  } catch (error: any) {
    console.error('Save report API error:', error);
    return NextResponse.json({ error: error.message || 'Rapor kaydedilirken bir hata oluştu.' }, { status: 500 });
  }
}
