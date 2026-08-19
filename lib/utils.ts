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

