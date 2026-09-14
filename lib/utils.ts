export function getAssignedLetter(baslik?: string): string {
  const rawTitle = (baslik || '').toLowerCase();
  if (rawTitle.includes('kalite')) return 'A';
  if (rawTitle.includes('eğitim') || rawTitle.includes('öğretim')) return 'B';
  if (rawTitle.includes('araştırma')) return 'C';
  if (rawTitle.includes('toplumsal')) return 'D';
  if (rawTitle.includes('yönetim')) return 'E';
  return '';
}

export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  
  const ALLOWED_EXTENSIONS = new Set([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
    'png', 'jpg', 'jpeg', 'webp',
    'mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v',
    'mp3', 'wav', 'ogg'
  ]);

  if (!fileExt || !ALLOWED_EXTENSIONS.has(fileExt)) {
    return {
      valid: false,
      error: `Güvenlik Kısıtlaması: ".${fileExt}" uzantılı dosya yüklenmesine izin verilmemektedir. Lütfen PDF, Word, Excel veya resim formatında bir dosya yükleyin.`
    };
  }

  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mkv|avi|mov|wmv|flv|m4v)$/i.test(file.name);
  const maxBytes = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
  const maxMbStr = isVideo ? '50 MB' : '5 MB';

  if (file.size > maxBytes) {
    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Seçtiğiniz dosya (${file.name}) ${fileSizeMb} MB boyutundadır. ${isVideo ? 'Video' : 'Doküman'} dosyaları için maksimum izin verilen boyut ${maxMbStr}'dır. Lütfen dosya boyutunu küçültüp tekrar deneyin.`
    };
  }

  return { valid: true };
}

/**
 * Converts any legacy Supabase storage URL or relative proxy path
 * into a fully-qualified application proxy URL for Word reports.
 */
export function toProxyStorageUrl(url: string, origin: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  // Supabase storage format (e.g. .../storage/v1/object/public/bucket/path or .../storage/v1/object/sign/bucket/path)
  if (trimmed.includes('/storage/v1/object/')) {
    const parts = trimmed.split('/storage/v1/object/');
    const afterObject = parts[1]?.replace(/^public\//, '')?.replace(/^sign\//, '') || '';
    const [bucket, ...pathParts] = afterObject.split('?')[0].split('/');
    if (bucket && pathParts.length > 0) {
      const cleanPath = pathParts.join('/');
      return `${origin}/api/storage/${bucket}/${cleanPath}`;
    }
  }
  // Relative /api/storage/ format
  if (trimmed.startsWith('/api/storage/')) {
    return `${origin}${trimmed}`;
  }
  return trimmed;
}

/**
 * Replaces href attributes in report HTML so all internal document links point to the proxy URL
 */
export function sanitizeReportHtmlLinks(html: string, origin: string): string {
  if (!html) return html;
  return html.replace(/href=(["'])(.*?)\1/gi, (match, quote, href) => {
    const converted = toProxyStorageUrl(href, origin);
    return `href=${quote}${converted}${quote}`;
  });
}
