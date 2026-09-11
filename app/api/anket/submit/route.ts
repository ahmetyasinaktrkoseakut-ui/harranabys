import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import net from 'net';

// Bellek ici IP ve Oturum Rate Limiting Takibi (Kayan Pencere / Fast-Path)
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

function getTrustedClientIp(request: Request): string | null {
  // 1. Cloudflare Edge
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && net.isIP(cfIp.trim()) !== 0) return cfIp.trim();

  // 2. Vercel Platform Edge
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    const candidate = vercelIp.split(',')[0].trim();
    if (net.isIP(candidate) !== 0) return candidate;
  }

  // 3. Nginx / Ters Vekil Real-IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp && net.isIP(realIp.trim()) !== 0) return realIp.trim();

  // Guvenilir IP yoksa NULL donulur (ortak unverified_edge atanmaz; global DoS onlenir)
  return null;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Sistem veritabani ayarlari eksik.' }, { status: 500 });
    }

    // 1. Istemci IP tespiti (Doğrulanmış proxy başlıkları ile)
    const trustedIp = getTrustedClientIp(request);
    const ipHash = trustedIp
      ? crypto.createHash('sha256').update(trustedIp + (supabaseServiceKey || 'abys_salt')).digest('hex')
      : null;

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

    // 3. Zorunlu Oturum / Cihaz Belirteci Denetimi
    const safeSessionToken = session_token && typeof session_token === 'string' && session_token.trim() !== ''
      ? session_token.trim().substring(0, 64)
      : null;

    if (!safeSessionToken) {
      return NextResponse.json({ error: 'Gecersiz oturum belirteci. Lutfen sayfayi yenileyiniz.' }, { status: 400 });
    }

    // 4. Payload Boyut Guvenligi (Maksimum 64KB)
    const payloadSize = Buffer.byteLength(JSON.stringify(cevaplar), 'utf8');
    if (payloadSize > 65536) {
      return NextResponse.json({ error: 'Anket yanit verisi boyutu izin verilen siniri (64KB) asiyor.' }, { status: 413 });
    }

    const now = Date.now();

    // 5. Fast-Path Bellekici Denetimler
    if (ipHash) {
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
    }

    const lastSessionSubmit = sessionRateMap.get(safeSessionToken) || 0;
    if (now - lastSessionSubmit < 15000) {
      return NextResponse.json(
        { error: 'Bu oturumdan cok sik yanit gonderildi. Lutfen 15 saniye sonra tekrar deneyin.' },
        { status: 429 }
      );
    }

    // 6. Atomik Veritabani Rate Limit Denetimi (RPC) - FAIL CLOSE
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // A. IP Bazlı Atomik Sayac Denetimi (Eger dogrulanmis IP varsa)
    if (ipHash) {
      try {
        const { data: ipAllowed, error: ipRpcErr } = await supabaseAdmin.rpc('check_and_increment_anket_rate_limit', {
          p_key_type: 'ip',
          p_key_value: ipHash,
          p_anket_id: anket_id,
          p_window_seconds: 60,
          p_max_requests: 5
        });

        // FAIL CLOSE: RPC hatasında ASLA INSERT yapılmaz!
        if (ipRpcErr) {
          console.error('IP rate limit RPC hatasi:', ipRpcErr);
          return NextResponse.json({ error: 'Guvenlik dogrulamasi gerceklestirilemedi. Islem durduruldu.' }, { status: 500 });
        }
        if (ipAllowed === false) {
          return NextResponse.json(
            { error: 'Ayni ag uzerinden kisa surede cok fazla yanit gonderildi. Lutfen bir dakika bekleyin.' },
            { status: 429 }
          );
        }
      } catch (rpcEx) {
        console.error('IP RPC istisnasi:', rpcEx);
        return NextResponse.json({ error: 'Guvenlik dogrulamasi istisnasi. Islem durduruldu.' }, { status: 500 });
      }
    }

    // B. Oturum / Cihaz Bazlı Zorunlu Atomik Sayac Denetimi
    try {
      const { data: sessAllowed, error: sessRpcErr } = await supabaseAdmin.rpc('check_and_increment_anket_rate_limit', {
        p_key_type: 'session',
        p_key_value: safeSessionToken,
        p_anket_id: anket_id,
        p_window_seconds: 15,
        p_max_requests: 1
      });

      // FAIL CLOSE: RPC hatasında ASLA INSERT yapılmaz!
      if (sessRpcErr) {
        console.error('Session rate limit RPC hatasi:', sessRpcErr);
        return NextResponse.json({ error: 'Oturum guvenlik dogrulamasi gerceklestirilemedi. Islem durduruldu.' }, { status: 500 });
      }
      if (sessAllowed === false) {
        return NextResponse.json(
          { error: 'Bu oturumdan cok sik yanit gonderildi. Lutfen 15 saniye bekleyin.' },
          { status: 429 }
        );
      }
    } catch (rpcEx) {
      console.error('Session RPC istisnasi:', rpcEx);
      return NextResponse.json({ error: 'Oturum guvenlik dogrulamasi istisnasi. Islem durduruldu.' }, { status: 500 });
    }

    // 7. Anketin mevcut olup olmadigini dogrula
    const { data: anket, error: anketError } = await supabaseAdmin
      .from('anketler')
      .select('id, baslik')
      .eq('id', anket_id)
      .single();

    if (anketError || !anket) {
      return NextResponse.json({ error: 'Belirtilen anket bulunamadi veya kapatilmis.' }, { status: 404 });
    }

    // 8. Yanıtı Ekle (ipHash yoksa kesinlikle NULL atanır, ortak sayaç oluşturulmaz)
    const { error: insertError } = await supabaseAdmin
      .from('anket_cevaplari')
      .insert({
        anket_id,
        cevaplar,
        session_token: safeSessionToken,
        ip_hash: ipHash || null
      });

    if (insertError) {
      console.error('Anket yanit kaydi hatasi:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Basarili gonderim: bellekici sayaclari da guncelle
    if (ipHash) {
      const rec = ipRateMap.get(ipHash);
      if (rec) {
        rec.timestamps.push(now);
        rec.lastSubmit = now;
      }
    }
    sessionRateMap.set(safeSessionToken, now);

    return NextResponse.json({ success: true, message: 'Yanitiniz basariyla kaydedildi.' });

  } catch (error: any) {
    console.error('Anket gonderim route hatasi:', error);
    return NextResponse.json({ error: 'Sunucu hatasi olustu.' }, { status: 500 });
  }
}
