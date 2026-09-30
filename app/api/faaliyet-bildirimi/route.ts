import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Basit IP tabanlı rate limit (60 saniyede maks 5 gönderim)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.expiresAt) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + 60_000 });
    return true;
  }
  if (record.count >= 5) {
    return false;
  }
  record.count++;
  return true;
}

// Güvenli dosya denetimi
const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx']);
const ZIP_HEADER = [0x50, 0x4B, 0x03, 0x04];

function validateFileBuffer(buffer: Buffer, ext: string): { valid: boolean; error?: string } {
  if (buffer.length < 8) {
    return { valid: false, error: 'Dosya içeriği çok küçük veya bozuk.' };
  }

  const headerText = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1').toLowerCase();
  if (
    headerText.includes('<?php') ||
    headerText.includes('<script') ||
    headerText.includes('eval(') ||
    headerText.includes('base64_decode') ||
    headerText.includes('cmd.exe') ||
    headerText.includes('/bin/sh')
  ) {
    return { valid: false, error: 'Dosya güvenlik kısıtlarına takıldı.' };
  }

  if (ext === 'pdf') {
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    if (!isPdf) return { valid: false, error: 'Geçersiz PDF formatı.' };
    return { valid: true };
  }

  if (ext === 'png') {
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    if (!isPng) return { valid: false, error: 'Geçersiz PNG formatı.' };
    return { valid: true };
  }

  if (ext === 'jpg' || ext === 'jpeg') {
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    if (!isJpg) return { valid: false, error: 'Geçersiz JPEG formatı.' };
    return { valid: true };
  }

  if (['docx', 'xlsx'].includes(ext)) {
    const isZip = buffer[0] === ZIP_HEADER[0] && buffer[1] === ZIP_HEADER[1] &&
                  buffer[2] === ZIP_HEADER[2] && buffer[3] === ZIP_HEADER[3];
    if (!isZip) return { valid: false, error: 'Geçersiz Office belgesi.' };
    if (buffer.toString('latin1').includes('vbaProject.bin')) {
      return { valid: false, error: 'Makro içeren belgeler kabul edilmez.' };
    }
    return { valid: true };
  }

  return { valid: true };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limit Kontrolü
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Çok fazla istek gönderildi. Lütfen bir dakika bekleyin.' }, { status: 429 });
    }

    // 2. FormData Parse
    const formData = await req.formData();
    
    // Honeypot kontrolü (Bot engelleme)
    const honeypot = formData.get('website')?.toString();
    if (honeypot) {
      return NextResponse.json({ success: true, message: 'Form alındı.' });
    }

    const adSoyad = formData.get('adSoyad')?.toString().trim();
    const email = formData.get('email')?.toString().trim() || null;
    const faaliyetTuru = formData.get('faaliyetTuru')?.toString().trim();
    const faaliyetAdi = formData.get('faaliyetAdi')?.toString().trim();
    const duzenleyenKurum = formData.get('duzenleyenKurum')?.toString().trim() || null;
    const faaliyetTarihi = formData.get('faaliyetTarihi')?.toString().trim();
    const aciklama = formData.get('aciklama')?.toString().trim() || null;
    const altOlcutIdStr = formData.get('altOlcutId')?.toString().trim();
    const file = formData.get('file') as File | null;

    if (!adSoyad || !faaliyetTuru || !faaliyetAdi || !faaliyetTarihi || !altOlcutIdStr || !file) {
      return NextResponse.json({ error: 'Lütfen tüm zorunlu alanları doldurun ve kanıt belgesi ekleyin.' }, { status: 400 });
    }

    const altOlcutId = parseInt(altOlcutIdStr, 10);
    if (isNaN(altOlcutId)) {
      return NextResponse.json({ error: 'Geçersiz ölçüt seçimi.' }, { status: 400 });
    }

    // 3. Supabase Bağlantısı & Aktif Dönem Denetimi
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Sistemde aktif olan dönemi al
    const { data: activePeriod, error: periodErr } = await supabaseAdmin
      .from('donemler')
      .select('id, donem_adi, is_active')
      .eq('is_active', true)
      .maybeSingle();

    if (periodErr || !activePeriod) {
      return NextResponse.json({ error: 'Sistemde şu an aktif bir dönem bulunamadı.' }, { status: 400 });
    }

    // 4. Dosya Doğrulaması (Maks 15 MB)
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Dosya boyutu 15 MB sınırını aşamaz.' }, { status: 400 });
    }

    const rawExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(rawExt)) {
      return NextResponse.json({ error: 'Yalnızca PDF, PNG, JPG, JPEG, WEBP, DOCX veya XLSX formatı kabul edilir.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const validation = validateFileBuffer(fileBuffer, rawExt);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Dosya güvenlik doğrulaması başarısız.' }, { status: 400 });
    }

    // 5. Dosyayı Private Storage Bucket'a Yükle
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `dis_faaliyetler/${activePeriod.id}/${altOlcutId}/${crypto.randomUUID()}-${cleanFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('kanit_dosyalari')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('[FAALIYET UPLOAD] Storage yükleme hatası:', uploadError);
      return NextResponse.json({ error: 'Dosya depolanamadı. Lütfen tekrar deneyin.' }, { status: 500 });
    }

    // Proxy URL formatı
    const proxyUrl = `/api/storage/kanit_dosyalari/${storagePath}`;
    const fileSizeKB = Math.round(file.size / 1024);

    // 6. dis_faaliyet_kanitlari Tablosuna Kayıt
    const { data: insertedActivity, error: insertError } = await supabaseAdmin
      .from('dis_faaliyet_kanitlari')
      .insert({
        donem_id: activePeriod.id,
        alt_olcut_id: altOlcutId,
        ad_soyad: adSoyad,
        email: email,
        faaliyet_turu: faaliyetTuru,
        faaliyet_adi: faaliyetAdi,
        duzenleyen_kurum: duzenleyenKurum,
        faaliyet_tarihi: faaliyetTarihi,
        aciklama: aciklama,
        dosya_adi: file.name,
        dosya_url: proxyUrl,
        dosya_boyutu: fileSizeKB,
        durum: 'beklemede',
      })
      .select('id')
      .single();

    if (insertError || !insertedActivity) {
      console.error('[FAALIYET INSERT] Tablo kayıt hatası:', insertError);
      return NextResponse.json({ error: 'Faaliyet kaydı oluşturulamadı.' }, { status: 500 });
    }

    // 7. dosya_yetkilendirmeleri Tablosuna Kayıt (Proxy 403 engeli)
    await supabaseAdmin
      .from('dosya_yetkilendirmeleri')
      .insert({
        bucket: 'kanit_dosyalari',
        storage_path: storagePath,
        resource_type: 'dis_faaliyet',
        resource_id: String(insertedActivity.id),
        alt_olcut_id: altOlcutId,
        donem_id: activePeriod.id,
        owner_id: null,
        original_url: proxyUrl,
        metadata: {
          faaliyet_adi: faaliyetAdi,
          ad_soyad: adSoyad,
          faaliyet_turu: faaliyetTuru,
        },
      });

    return NextResponse.json({
      success: true,
      message: 'Faaliyetiniz ve kanıt belgeniz başarıyla iletildi. İlgili komisyon ve ölçüt sorumlusu inceledikten sonra sisteme dahil edilecektir.',
    });
  } catch (error: any) {
    console.error('[FAALIYET ROUTE] Hata:', error);
    return NextResponse.json({ error: error?.message || 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const [periodRes, abRes, aoRes] = await Promise.all([
      supabaseAdmin
        .from('donemler')
        .select('id, donem_adi, is_active')
        .eq('is_active', true)
        .maybeSingle(),
      supabaseAdmin
        .from('ana_basliklar')
        .select('id, kod, baslik_adi')
        .order('id'),
      supabaseAdmin
        .from('alt_olcutler')
        .select('id, kod, olcut_adi, ana_baslik_id')
        .order('id'),
    ]);

    return NextResponse.json({
      activePeriod: periodRes.data || null,
      anaBasliklar: abRes.data || [],
      altOlcutler: aoRes.data || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Veriler yüklenemedi.' }, { status: 500 });
  }
}

