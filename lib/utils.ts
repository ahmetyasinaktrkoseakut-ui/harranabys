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
 * Validates whether a given URL points strictly to this application's internal storage
 * (either a relative /api/storage/ path, a same-origin absolute /api/storage/ path,
 * or the project's configured Supabase storage host).
 * Fails safely (returns false) if Supabase URL configuration is missing or malformed.
 */
export function isInternalStorageUrl(url?: string, appOrigin?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // 1. Göreceli proxy yolu: /api/storage/
  if (trimmed.startsWith('/api/storage/')) {
    return true;
  }

  const currentOrigin = (appOrigin || (typeof window !== 'undefined' ? window.location?.origin : '') || '').trim();

  try {
    const parsed = new URL(trimmed, currentOrigin || 'http://localhost');

    // 2. Tam URL ile aynı-origin /api/storage/ denetimi
    if (parsed.pathname.startsWith('/api/storage/')) {
      if (currentOrigin) {
        try {
          const parsedOrigin = new URL(currentOrigin).origin;
          if (parsed.origin === parsedOrigin) {
            return true;
          }
        } catch {
          return false;
        }
      }
      return false;
    }

    // 3. Yapılandırılmış proje Supabase depolama adresi denetimi (Fail-Safe)
    if (trimmed.includes('/storage/v1/object/')) {
      const supabaseEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseEnv) return false;
      try {
        const parsedSupabase = new URL(supabaseEnv);
        if (parsed.host === parsedSupabase.host && parsed.pathname.includes('/storage/v1/object/')) {
          return true;
        }
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Converts any legacy Supabase storage URL or relative proxy path
 * into a fully-qualified application proxy URL for Word reports and links.
 */
export function toProxyStorageUrl(url: string, origin: string): string {
  if (!url) return url;
  if (!isInternalStorageUrl(url, origin)) return url;
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

export function healSplitEvidenceTags(html: string): string {
  if (!html) return html;
  return html.replace(
    /<a\s+[^>]*href=["']([^"']*)["'][^>]*>\s*(?:<strong>|<b>)?\s*(?:<u>)?\s*\[\s*(?:<\/u>)?\s*(?:<\/b>|<\/strong>)?\s*<\/a>\s*<a\s+[^>]*href=["']([^"']*)["'][^>]*>\s*(?:<strong>|<b>)?\s*(?:<u>)?\s*(Evidence|Kanıt|edivence)\s*(?:<\/u>)?\s*(?:<\/b>|<\/strong>)?\s*<\/a>\s*<a\s+[^>]*href=["']([^"']*)["'][^>]*>\s*(?:<strong>|<b>)?\s*(?:<u>)?\s*([t\s]*\d+\])\s*(?:<\/u>)?\s*(?:<\/b>|<\/strong>)?\s*<\/a>/gi,
    (match, u1, u2, word, u3, numPart) => {
      const cleanNum = numPart.replace(/^[t\s]+/, '').replace(/\]$/, '').trim();
      const properWord = word.toLowerCase().includes('edivence') ? 'Evidence' : word;
      return `<a rel="noopener noreferrer" href="${u1}"><strong><u>[${properWord} ${cleanNum}]</u></strong></a>`;
    }
  );
}

/**
 * Replaces href attributes in report HTML so all internal document links point to the proxy URL,
 * strips target="_blank" specifically and only from internal storage links,
 * and heals any fragmented / split evidence link tags created by rich-text copy-pasting.
 */
export function sanitizeReportHtmlLinks(html: string, origin: string): string {
  if (!html) return html;
  const healed = healSplitEvidenceTags(html);
  return healed.replace(/<a\s+([^>]*?)href=(["'])(.*?)\2([^>]*?)>/gi, (match, beforeHref, quote, href, afterHref) => {
    if (isInternalStorageUrl(href, origin)) {
      const convertedHref = toProxyStorageUrl(href, origin);
      const cleanBefore = beforeHref.replace(/\s*target=(["'])_blank\1/gi, '');
      const cleanAfter = afterHref.replace(/\s*target=(["'])_blank\1/gi, '');
      return `<a ${cleanBefore}href=${quote}${convertedHref}${quote}${cleanAfter}>`;
    }
    return match;
  });
}
