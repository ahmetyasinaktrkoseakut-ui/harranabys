import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// İzin verilen uzantılar ve MIME tipleri
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'odt', 'ods', 'odp', 'txt', 'csv'
]);

// ZIP başlığı (DOCX, XLSX, ODT vb.)
const ZIP_HEADER = [0x50, 0x4B, 0x03, 0x04];

function validateMagicBytes(buffer: Buffer, ext: string): { valid: boolean; error?: string } {
  if (buffer.length < 8) {
    return { valid: false, error: 'Dosya içeriği çok küçük veya bozuk.' };
  }

  // Zararlı içerik taraması (XSS / Web Shell koruması)
  const headerText = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1').toLowerCase();
  if (
    headerText.includes('<?php') ||
    headerText.includes('<script') ||
    headerText.includes('eval(') ||
    headerText.includes('base64_decode') ||
    headerText.includes('cmd.exe') ||
    headerText.includes('/bin/sh')
  ) {
    return { valid: false, error: 'Dosya zararlı betik veya kod deseni içeriyor.' };
  }

  // PDF denetimi: %PDF-
  if (ext === 'pdf') {
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    if (!isPdf) return { valid: false, error: 'Geçersiz PDF dosya yapısı.' };
    return { valid: true };
  }

  // PNG denetimi: 89 50 4E 47 0D 0A 1A 0A
  if (ext === 'png') {
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    if (!isPng) return { valid: false, error: 'Geçersiz PNG görsel yapısı.' };
    return { valid: true };
  }

  // JPEG denetimi: FF D8 FF
  if (ext === 'jpg' || ext === 'jpeg') {
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    if (!isJpg) return { valid: false, error: 'Geçersiz JPEG görsel yapısı.' };
    return { valid: true };
  }

  // WEBP denetimi: RIFF....WEBP
  if (ext === 'webp') {
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    if (!isRiff || !isWebp) return { valid: false, error: 'Geçersiz WEBP görsel yapısı.' };
    return { valid: true };
  }

  // Office / OpenDocument (DOCX, XLSX, PPTX, ODT vb.) -> ZIP temelli
  if (['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].includes(ext)) {
    const isZip = buffer[0] === ZIP_HEADER[0] && buffer[1] === ZIP_HEADER[1] &&
                  buffer[2] === ZIP_HEADER[2] && buffer[3] === ZIP_HEADER[3];
    if (!isZip) return { valid: false, error: 'Geçersiz Office/Belge arşivi (ZIP yapısı eksik).' };

    // Makro filtresi (vbaProject.bin engeli)
    const rawZipStr = buffer.toString('latin1');
    if (rawZipStr.includes('vbaProject.bin')) {
      return { valid: false, error: 'Makro içeren belgelerin yüklenmesine izin verilmez.' };
    }
    return { valid: true };
  }

  // Düz metin / CSV
  if (ext === 'txt' || ext === 'csv') {
    // Null byte içermemeli
    for (let i = 0; i < Math.min(buffer.length, 512); i++) {
      if (buffer[i] === 0x00) {
        return { valid: false, error: 'Metin dosyası ikili (binary) içerik barındıramaz.' };
      }
    }
    return { valid: true };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const cookieStore = await cookies();

    // 1. Kullanıcı oturumunu doğrula
    const supabaseAuth = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen önce giriş yapınız.' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 2. Kullanıcı rolünü doğrula
    const { data: profil } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .single();

    const userRole = (profil?.rol || '').toLowerCase();
    const isAdmin = userRole.includes('admin') || userRole.includes('yonetici') || userRole.includes('yönetici');
    const isObserver = userRole.includes('gozlemci') || userRole.includes('gözlemci');

    // Gözlemci rolünün belge yükleme yetkisi yoktur (kesin kural)
    if (isObserver) {
      return NextResponse.json({ error: 'Gözlemci rolü yalnızca belgeleri inceleyebilir; yükleme yetkisi yoktur.' }, { status: 403 });
    }

    // 3. FormData Ayrıştır
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string) || 'dokumanlar';
    const resourceType = (formData.get('resource_type') as string) || 'puko';
    const rawAltOlcutId = formData.get('alt_olcut_id') as string | null;
    const rawResourceId = formData.get('resource_id') as string | null;
    const rawDonemId = formData.get('donem_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Yüklenecek dosya bulunamadı.' }, { status: 400 });
    }

    // İzin verilen bucket kontrolü
    if (bucket !== 'dokumanlar' && bucket !== 'kanit_dosyalari') {
      return NextResponse.json({ error: 'Geçersiz depolama alanı.' }, { status: 400 });
    }

    // Boyut denetimi (Maksimum 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Dosya boyutu 25 MB sınırını aşıyor.' }, { status: 413 });
    }

    // Uzantı denetimi
    const originalName = file.name || 'document';
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `.${ext} uzantılı dosya yüklenmesine izin verilmez.` }, { status: 400 });
    }

    // 4. Yetki Denetimi (Ölçüt Ataması ve Dönem Kontrolü)
    const parsedAltOlcutId = rawAltOlcutId && /^\d+$/.test(rawAltOlcutId.trim()) ? parseInt(rawAltOlcutId.trim(), 10) : null;
    const safeDonemId = rawDonemId && rawDonemId.trim() !== '' ? rawDonemId.trim() : null;

    if (!isAdmin) {
      // Normal kullanıcı için alt_olcut_id VE donem_id ZORUNLUDUR!
      // Eksik yetki parametresi ASLA bypass oluşturmaz; doğrudan 403 döner.
      if (!parsedAltOlcutId || !safeDonemId) {
        return NextResponse.json(
          { error: 'Yetkilendirme parametreleri (alt_olcut_id ve donem_id) eksik. Yükleme izni reddedildi.' },
          { status: 403 }
        );
      }

      let isAuthorized = false;

      // A. Kullanıcının aktif dönem ve ölçüte doğrudan ataması var mı?
      const { data: atamaRows } = await supabaseAdmin
        .from('kullanici_olcut_atamalari')
        .select('id')
        .eq('user_id', user.id)
        .eq('alt_olcut_id', parsedAltOlcutId)
        .eq('donem_id', safeDonemId);

      if (atamaRows && atamaRows.length > 0) {
        isAuthorized = true;
      } else {
        // B. Başlık Koordinatörü yetkisi denetimi
        const { data: currentOlcut } = await supabaseAdmin
          .from('alt_olcutler')
          .select('kod')
          .eq('id', parsedAltOlcutId)
          .maybeSingle();

        if (currentOlcut?.kod) {
          const { data: coordData } = await supabaseAdmin
            .from('baslik_koordinatorleri')
            .select('baslik')
            .eq('kullanici_id', user.id);

          const assignedLetter = coordData?.[0]?.baslik ? coordData[0].baslik.trim().charAt(0).toUpperCase() : null;
          if (assignedLetter && currentOlcut.kod.startsWith(assignedLetter)) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Bu ölçüt ve dönem için kanıt belgesi yükleme yetkiniz bulunmamaktadır.' },
          { status: 403 }
        );
      }
    }

    // 5. Sunucu Tarafı Derin İçerik ve Magic-Byte Doğrulaması
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const validation = validateMagicBytes(fileBuffer, ext);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Dosya içerik doğrulaması başarısız.' }, { status: 400 });
    }

    // 6. Güvenli Dosya Yolu Üretimi (İstemciye güvenilmez)
    const prefix = parsedAltOlcutId ? `${parsedAltOlcutId}` : 'doc';
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const safeStoragePath = `${prefix}_${Date.now()}_${randomSuffix}.${ext}`;

    // 7. Supabase Storage'a Yükleme (upsert: false)
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(safeStoragePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: `Depolama yükleme hatası: ${uploadError.message}` }, { status: 502 });
    }

    // 8. ÖNCE dosya_yetkilendirmeleri tablosuna mapping kaydını ekle
    const proxyUrl = `/api/storage/${bucket}/${safeStoragePath}`;
    const pukoId = resourceType === 'puko' && rawResourceId && /^\d+$/.test(rawResourceId.trim()) ? parseInt(rawResourceId.trim(), 10) : null;
    const odrId = resourceType === 'ozdegerlendirme_raporu' && rawResourceId ? rawResourceId : null;

    const { error: mappingError } = await supabaseAdmin
      .from('dosya_yetkilendirmeleri')
      .insert({
        bucket,
        storage_path: safeStoragePath,
        resource_type: resourceType,
        resource_id: rawResourceId || null,
        alt_olcut_id: parsedAltOlcutId,
        puko_degerlendirme_id: pukoId,
        ozdegerlendirme_raporu_id: odrId,
        donem_id: safeDonemId,
        owner_id: user.id,
        original_url: proxyUrl,
        metadata: {
          original_name: originalName,
          size_bytes: file.size,
          mime_type: file.type
        }
      });

    if (mappingError) {
      console.error('Mapping insert error (dosya_yetkilendirmeleri):', mappingError);
      // Not: Yüklenen dosya yetim kaldı ama ESKİ VERİ VE ESKİ DOSYA KORUNDU
      return NextResponse.json({ error: 'Yetkilendirme kaydı oluşturulamadı.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: proxyUrl,
      storagePath: safeStoragePath,
      bucket,
      name: originalName,
      size: Math.round(file.size / 1024)
    });

  } catch (error: any) {
    console.error('Server upload route exception:', error);
    return NextResponse.json({ error: 'Sunucu yükleme işleminde beklenmeyen hata.' }, { status: 500 });
  }
}
