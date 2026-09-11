/**
 * Dosya Güvenlik ve Bütünlük Doğrulayıcısı
 * - Magic Byte (Dosya Başlığı İmzası) Kontrolü
 * - MIME Türü Doğrulaması
 * - Dosya Uzantısı & Çift Uzantı (Polyglot) Saldırı Koruması
 * - Dosya Boyut Sınırı (Varsayılan 25MB)
 * - Zararlı Kod / Script Deseni Taraması
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'doc', 'xls'] as const;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;

const MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/jpg'],
  jpeg: ['image/jpeg', 'image/jpg'],
  webp: ['image/webp'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  doc: ['application/msword'],
  xls: ['application/vnd.ms-excel'],
};

// Dosya başlığı magic byte imzaları
const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // \x89PNG\r\n\x1a\n
  jpeg: [0xFF, 0xD8, 0xFF], // JPEG SOI marker
  zip: [0x50, 0x4B, 0x03, 0x04], // PK.. (DOCX, XLSX)
  riff: [0x52, 0x49, 0x46, 0x46], // RIFF (WEBP)
  ole: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE2 Compound File (DOC, XLS)
};

const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'jsp', 'asp', 'aspx',
  'cgi', 'pl', 'py', 'js', 'vbs', 'jar', 'scr', 'dll', 'com', 'msi'
];

/**
 * Dosyayı kapsamlı güvenlik kontrolünden geçirir.
 */
export async function validateUploadedFile(file: File, maxBytes = MAX_FILE_SIZE_BYTES): Promise<ValidationResult> {
  // 1. Boyut kontrolü
  if (!file || file.size === 0) {
    return { valid: false, error: 'Dosya boş veya geçersiz.' };
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: 'Dosya boyutu çok büyük (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB). İzin verilen maksimum boyut: ' + Math.round(maxBytes / (1024 * 1024)) + ' MB.'
    };
  }

  // 2. Dosya adı ve uzantı kontrolü
  const fileName = file.name.trim();
  const nameParts = fileName.split('.');
  if (nameParts.length < 2) {
    return { valid: false, error: 'Geçersiz dosya: Uzantı bulunamadı.' };
  }

  // Çift uzantı saldırısı koruması (örn: exploit.php.pdf, zararlı.exe.docx)
  for (let i = 0; i < nameParts.length - 1; i++) {
    const part = nameParts[i].toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(part)) {
      return { valid: false, error: 'Güvenlik uyarısı: Şüpheli çift uzantı veya çalıştırılabilir dosya adı algılandı.' };
    }
  }

  const ext = nameParts.pop()!.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: '.' + ext + ' uzantılı dosya yüklenemez. Yalnızca PDF, Görsel (PNG, JPG, WEBP) ve Office (Word, Excel) dosyalarına izin verilir.'
    };
  }

  // 3. MIME Türü kontrolü
  const expectedMimes = MIME_MAP[ext] || [];
  if (file.type && expectedMimes.length > 0 && !expectedMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Dosya MIME türü (' + file.type + ') ile dosya uzantısı (.' + ext + ') uyuşmuyor.'
    };
  }

  // 4. Magic Bytes (Gerçek Dosya Başlığı İmzası) Kontrolü
  try {
    const sliceBuffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(sliceBuffer);

    const matchBytes = (signature: number[]) => {
      if (bytes.length < signature.length) return false;
      return signature.every((b, idx) => bytes[idx] === b);
    };

    let magicMatches = false;

    if (ext === 'pdf') {
      magicMatches = matchBytes(SIGNATURES.pdf);
    } else if (ext === 'png') {
      magicMatches = matchBytes(SIGNATURES.png);
    } else if (ext === 'jpg' || ext === 'jpeg') {
      magicMatches = matchBytes(SIGNATURES.jpeg);
    } else if (ext === 'webp') {
      magicMatches = matchBytes(SIGNATURES.riff) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50; // WEBP
    } else if (ext === 'docx' || ext === 'xlsx') {
      magicMatches = matchBytes(SIGNATURES.zip);
    } else if (ext === 'doc' || ext === 'xls') {
      magicMatches = matchBytes(SIGNATURES.ole);
    }

    if (!magicMatches) {
      return {
        valid: false,
        error: 'Dosya başlığı (.' + ext + ') imza standartlarına uymuyor. Dosya içeriği bozuk veya sahte uzantılı olabilir.'
      };
    }

    // 5. Polyglot & Script Taraması (Dosya başlığındaki gizli betik kalıntıları)
    const headerBuffer = await file.slice(0, 1024).arrayBuffer();
    const headerText = new TextDecoder('utf-8', { fatal: false }).decode(headerBuffer).toLowerCase();

    if (
      headerText.includes('<?php') ||
      headerText.includes('<script') ||
      headerText.includes('javascript:')
    ) {
      return {
        valid: false,
        error: 'Dosya içeriğinde izin verilmeyen betik/kod kalıpları tespit edildi.'
      };
    }

  } catch (err: any) {
    return { valid: false, error: 'Dosya güvenlik doğrulaması sırasında hata: ' + (err?.message || err) };
  }

  return { valid: true };
}
