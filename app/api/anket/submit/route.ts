import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Bellek ici IP ve Oturum Rate Limiting Takibi (Kayan Pencere / Sliding Window)
interface RateRecord {
  timestamps: number[];
  lastSubmit: number;
}

const ipRateMap = new Map<string, RateRecord>();
const sessionRateMap = new Map<string, number>();

// Periyodik bellek temizligi (10 dakikada bir eski kayitlari supur)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of ipRateMap.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < 60000);
      if (record.timestamps.length === 0 && now - record.lastSubmit > 300000) {
        ipRateMap.delete(key);
      }
    }
    for (const [key, lastTime] of sessionRateMap.entries()) {
      if (now - lastTime > 300000) {
        sessionRateMap.delete(key);
      }
    }
  }, 600000);
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Sistem veritabani ayarlari eksik.' }, { status: 500 });
    }

    // 1. Istemci IP ve Oturum Belirteci Cikarma
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : realIp) || '127.0.0.1';

    // KVKK/GDPR Uyumlu Kriptografik IP Hash (Gercek IP saklanmaz)
    const ipHash = crypto
      .createHash('sha256')
      .update(clientIp + (process.env.SUPABASE_SERVICE_ROLE_KEY || 'abys_salt_survey'))
      .digest('hex');

    // 2. Request Govdesini Ayristir
    const body = await request.json();
    const { anket_id, cevaplar, session_token, websiteHoney } = body;

    // Honeypot Tuzagi (Bot korumasi)
    if (websiteHoney && typeof websiteHoney === 'string' && websiteHoney.trim().length > 0) {
      return NextResponse.json({ success: true, message: 'Yanitiniz alindi.' });
    }

    if (!anket_id || !cevaplar || typeof cevaplar !== 'object') {
      return NextResponse.json({ error: 'Gecersiz anket veya yanit verisi.' }, { status: 400 });
    }

    // 3. Payload Boyut Guvenligi (Maksimum 64KB)
    const payloadSize = Buffer.byteLength(JSON.stringify(cevaplar), 'utf8');
    if (payloadSize > 65536) {
      return NextResponse.json({ error: 'Anket yanit verisi boyutu izin verilen siniri (64KB) asiyor.' }, { status: 413 });
    }

    const now = Date.now();

    // 4. IP Bazli Rate Limit Denetimi (Dakikada en fazla 5 yanit)
    let ipRecord = ipRateMap.get(ipHash);
    if (!ipRecord) {
      ipRecord = { timestamps: [], lastSubmit: 0 };
      ipRateMap.set(ipHash, ipRecord);
    }
    ipRecord.timestamps = ipRecord.timestamps.filter(t => now - t < 60000);

    if (ipRecord.timestamps.length >= 5) {
      return NextResponse.json(
        { error: 'Ayni ag uzerinden kisa surede cok fazla yanit gonderildi. Lutfen bir dakika bekleyin.' },
        { status: 429 }
      );
    }

    // 5. Oturum / Cihaz Bazli Rate Limit Denetimi (En az 15 saniye bekleme)
    const safeSessionToken = session_token ? String(session_token).substring(0, 64) : null;
    if (safeSessionToken) {
      const lastSessionSubmit = sessionRateMap.get(safeSessionToken) || 0;
      if (now - lastSessionSubmit < 15000) {
        return NextResponse.json(
          { error: 'Bu oturumdan cok sik yanit gonderildi. Lutfen 15 saniye sonra tekrar deneyin.' },
          { status: 429 }
        );
      }
    }

    // 6. Veritabanina Ekleme (Admin/Service Role Ile Guvenli Eklenir)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Anketin mevcut olup olmadigini dogrula
    const { data: anket, error: anketError } = await supabaseAdmin
      .from('anketler')
      .select('id, baslik')
      .eq('id', anket_id)
      .single();

    if (anketError || !anket) {
      return NextResponse.json({ error: 'Belirtilen anket bulunamadi veya kapatilmis.' }, { status: 404 });
    }

    const { error: insertError } = await supabaseAdmin
      .from('anket_cevaplari')
      .insert({
        anket_id,
        cevaplar,
        session_token: safeSessionToken,
        ip_hash: ipHash
      });

    if (insertError) {
      console.error('Anket yanit kaydi hatasi:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Basarili gonderim: sayaclari guncelle
    ipRecord.timestamps.push(now);
    ipRecord.lastSubmit = now;
    if (safeSessionToken) {
      sessionRateMap.set(safeSessionToken, now);
    }

    return NextResponse.json({ success: true, message: 'Yanitiniz basariyla kaydedildi.' });

  } catch (error: any) {
    console.error('Anket submit API hatasi:', error);
    return NextResponse.json({ error: error?.message || 'Beklenmeyen sunucu hatasi.' }, { status: 500 });
  }
}
