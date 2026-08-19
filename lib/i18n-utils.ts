export function getLocalizedField(item: any, prefix: string, locale: string): string {
  if (!item) return '';
  
  if (locale === 'en' && item[`${prefix}_en`]) {
    return item[`${prefix}_en`];
  }
  if (locale === 'ar' && item[`${prefix}_ar`]) {
    return item[`${prefix}_ar`];
  }
  
  // Fallback to Turkish (the default prefix)
  return item[prefix] || '';
}
