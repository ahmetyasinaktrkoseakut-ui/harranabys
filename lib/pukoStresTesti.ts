/**
 * Akreditasyon ve ÖDR Stres Testi Doğrulama Modülü
 *
 * Kullanıcı Talebine Uygun Ölçüt Bazlı Tespit Kriterleri:
 * 1. ÖDR'ye Alınmamış Ölçüt: Seçili dönemde henüz Özdeğerlendirme Raporu (ÖDR) oluşturulmamış / ÖDR'si boş olan alt ölçütler.
 * 2. Aşamalarda Kanıt Var, ÖDR'de Yok: PUKÖ aşamalarında kanıt yüklenmiş ancak bu kanıt ölçütün ÖDR raporuna aktarılmamış / atıf verilmemiş.
 * 3. Boş Aşamalar: Seçili dönemde ölçütün PUKÖ aşamasında kayıt bulunmayan veya açıklaması boş ve kanıtı olmayan aşamalar.
 */

export const PUKO_ASAMALARI = ['planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk'] as const;
export type PukoAsamasi = typeof PUKO_ASAMALARI[number];

export const PUKO_KONTROL_ASAMALARI = ['planlama', 'uygulama', 'kontrol', 'onlem'] as const;

export const ASAMA_ISIMLERI: Record<string, string> = {
  planlama: 'Planlama',
  uygulama: 'Uygulama',
  kontrol: 'Kontrol Etme',
  onlem: 'Önlem Alma',
};

export interface KanitDosyasi {
  name?: string;
  url?: string;
  annotated_url?: string;
  size?: number;
  evidence_no?: number | string;
  evidence_id?: string;
  id?: string;
  storagePath?: string;
  bucket?: string;
  [key: string]: any;
}

export interface PukoKayit {
  id?: string;
  alt_olcut_id: number | string;
  puko_asamasi: string;
  aciklama?: string | null;
  kanit_dosyalari?: KanitDosyasi[] | null;
  durum?: string | null;
  donem_id?: string | null;
}

export interface OdrKayit {
  id?: string;
  alt_olcut_id: number | string;
  icerik?: string | null;
  icerik_en?: string | null;
  kanitlar?: any[] | null;
  onay_durumu?: string | null;
  donem_id?: string | null;
}

export interface AltOlcut {
  id: number | string;
  kod: string;
  olcut_adi: string;
}

export interface OdrAlinmamisOlcut {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asama_sayisi: number;
  puko_kanit_sayisi: number;
}

export interface AsamadaVarOdrdeYokKanit {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asamasi: string;
  kanit_adi: string;
  kanit_url: string;
}

export interface BosAsama {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asamasi: string;
  asama_adi: string;
  durum_aciklamasi: string;
}

export interface IngilizceOdrSorunu {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  sorun_tipi: 'bos_veya_kopyalanmis' | 'kanit_baglantisi_eksik';
  aciklama: string;
  eksik_kanitlar?: string[];
}

export interface StresTestiSonucu {
  odrAlinmamisOlcutler: OdrAlinmamisOlcut[];
  asamadaVarOdrdeYok: AsamadaVarOdrdeYokKanit[];
  bosAsamalar: BosAsama[];
  ingilizceOdrSorunlari: IngilizceOdrSorunu[];
  toplamSorun: number;
}

/**
 * HTML etiketlerini ve özel boşluk karakterlerini ayıklayarak metnin anlamsız boş olup olmadığını belirler.
 */
export function isHtmlContentEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<(img|iframe|table|svg)\b/i.test(html)) return false;
  const stripped = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length === 0;
}

/**
 * Türkçe ve İngilizce metinleri karşılaştırmak için HTML etiketlerini, özel karakterleri
 * ve çoklu boşlukları temizleyerek yalın metin haline getirir.
 */
export function normalizeHtmlForComparison(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Dosya adındaki işaretleme eki (_isaretli, _annotated), zaman damgası ve uzantıyı temizleyerek temel doküman kimliğini çıkarır.
 */
export function normalizeDocKey(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/_isaretli|_annotated/g, '')
    .replace(/[0-9]{10,}_/g, '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9ğüşıöç]/g, '')
    .trim();
}

export interface HtmlEvidenceLink {
  href?: string;
  evidenceId?: string;
  text?: string;
}

/**
 * HTML içeriğindeki tüm anchor (<a>) etiketlerini ayıklar ve href ile data-evidence-id niteliklerini çıkarır.
 * Çok satırlı bağlantıları ve zengin metin düzenleyici etiketlerini desteklemek için /gis bayrağı kullanır.
 */
export function extractEvidenceLinks(html: string | null | undefined): HtmlEvidenceLink[] {
  if (!html) return [];
  const links: HtmlEvidenceLink[] = [];
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const attrs = match[1];
    const rawText = match[2];

    const hrefMatch = attrs.match(/\bhref=["']([^"']*)["']/i);
    const idMatch = attrs.match(/\bdata-evidence-id=["']([^"']*)["']/i);

    const cleanText = rawText
      ? rawText
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : undefined;

    links.push({
      href: hrefMatch ? hrefMatch[1].trim() : undefined,
      evidenceId: idMatch ? idMatch[1].trim() : undefined,
      text: cleanText,
    });
  }
  return links;
}

const KNOWN_STORAGE_BUCKETS = ['dokumanlar', 'kanitlar', 'kanit_dosyalari', 'arsiv', 'sinav_arsivleri'];

export interface ParsedStorageReference {
  bucket: string | null;
  path: string;
}

/**
 * Verilen URL veya dosya yolunu ayrıştırarak { bucket, path } nesnesine dönüştürür.
 * Supabase storage (.../storage/v1/object/public/{bucket}/{path}),
 * Proxy storage (.../api/storage/{bucket}/{path}) ve doğrudan klasör yollarını destekler.
 */
export function parseStorageReference(input?: string | null, fallbackBucket?: string | null): ParsedStorageReference | null {
  if (!input) return null;
  let str = input.trim();
  if (!str) return null;

  // Hash ve query string temizle
  str = str.split('#')[0].split('?')[0].trim();
  try {
    str = decodeURIComponent(str);
  } catch {}

  // 1. Supabase Storage formatı (.../storage/v1/object/public/{bucket}/{path})
  const supabaseStorageIndex = str.indexOf('/storage/v1/object/');
  if (supabaseStorageIndex !== -1) {
    const after = str.substring(supabaseStorageIndex + '/storage/v1/object/'.length);
    const cleaned = after.replace(/^(public|authenticated|sign)\//i, '').replace(/^\/+/, '');
    const slashIdx = cleaned.indexOf('/');
    if (slashIdx !== -1) {
      return {
        bucket: cleaned.substring(0, slashIdx).trim(),
        path: cleaned.substring(slashIdx + 1).replace(/^\/+/, '').trim(),
      };
    }
    return { bucket: cleaned.trim(), path: '' };
  }

  // 2. Proxy Storage formatı (.../api/storage/{bucket}/{path})
  const proxyStorageIndex = str.indexOf('/api/storage/');
  if (proxyStorageIndex !== -1) {
    const after = str.substring(proxyStorageIndex + '/api/storage/'.length).replace(/^\/+/, '');
    const slashIdx = after.indexOf('/');
    if (slashIdx !== -1) {
      return {
        bucket: after.substring(0, slashIdx).trim(),
        path: after.substring(slashIdx + 1).replace(/^\/+/, '').trim(),
      };
    }
    return { bucket: after.trim(), path: '' };
  }

  // 3. HTTP URL ise (farklı endpoint)
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const u = new URL(str);
      const p = u.pathname.replace(/^\/+/, '');
      for (const b of KNOWN_STORAGE_BUCKETS) {
        if (p === b) return { bucket: b, path: '' };
        if (p.startsWith(`${b}/`)) {
          return { bucket: b, path: p.substring(b.length + 1) };
        }
      }
      return { bucket: fallbackBucket || null, path: p };
    } catch {}
  }

  // 4. Doğrudan dosya yolu veya bucket/yol (örn: dokumanlar/A/rapor.pdf veya A/rapor.pdf)
  const cleanPath = str.replace(/^\/+/, '').trim();
  for (const b of KNOWN_STORAGE_BUCKETS) {
    if (cleanPath === b) return { bucket: b, path: '' };
    if (cleanPath.startsWith(`${b}/`)) {
      return { bucket: b, path: cleanPath.substring(b.length + 1) };
    }
  }

  return { bucket: fallbackBucket || null, path: cleanPath };
}

/**
 * Bilinen depolama URL biçimlerini (Supabase storage URL'leri, proxy URL'leri ve doğrudan dosya yolları)
 * standart "bucket/yol" biçimine dönüştürür.
 */
export function toCanonicalStoragePath(input?: string | null): string {
  const ref = parseStorageReference(input);
  if (!ref) return '';
  if (ref.bucket) {
    return ref.path ? `${ref.bucket}/${ref.path}` : ref.bucket;
  }
  return ref.path;
}

/**
 * İki URL'nin veya depolama yolunun aynı dosyaya işaret edip etmediğini kontrol eder.
 * Kesinlikle parça/alt-dize (includes/endsWith) eşleşmesi yapmaz.
 * Bucket bilgisi iki tarafta da mevcut olmalı veya kanıt kaydı bağlamından (defaultBucket) doğrulanmalıdır.
 * Bucket'lar uyuşmadığı anda eşleşme KESİNLİKLE reddedilir.
 */
export function urlsMatch(href1?: string, href2?: string, defaultBucket?: string): boolean {
  if (!href1 || !href2) return false;
  const h1 = href1.trim();
  const h2 = href2.trim();
  if (!h1 || !h2) return false;

  // 1. Birebir eşitlik kontrolü (ham ve decode edilmiş)
  if (h1 === h2) return true;
  try {
    if (decodeURIComponent(h1) === decodeURIComponent(h2)) return true;
  } catch {}

  // 2. Depolama referanslarını bucket ve dosya yolu bazında tam karşılaştırma
  const r1 = parseStorageReference(h1, defaultBucket);
  const r2 = parseStorageReference(h2, defaultBucket);

  if (r1 && r2 && r1.path && r2.path) {
    // İKİ TARAFTA DA BUCKET BELLİYSE VE BUCKET'LAR FARKLIYSA KESİNLİKLE EŞLEŞMEZ!
    if (r1.bucket && r2.bucket && r1.bucket !== r2.bucket) {
      return false;
    }

    // Dosya yolları birebir aynı olmalı
    if (r1.path === r2.path) {
      // Bucket güvencesi: Eğer bir taraf hala bucketsız ise rastgele eşleşme kabul edilmez
      if (!r1.bucket || !r2.bucket) {
        return false;
      }
      return true;
    }

    return false;
  }

  // 3. Standart pathname tam eşitliği
  try {
    const p1 = (h1.startsWith('http') ? new URL(h1).pathname : h1.split('#')[0].split('?')[0]).replace(/^\/+/, '/');
    const p2 = (h2.startsWith('http') ? new URL(h2).pathname : h2.split('#')[0].split('?')[0]).replace(/^\/+/, '/');
    if (p1 === p2 || decodeURIComponent(p1) === decodeURIComponent(p2)) return true;
  } catch {}

  return false;
}

/**
 * HTML içeriğinde ilgili kanıt nesnesine işaret eden gerçek bir bağlantı olup olmadığını denetler.
 * Yalnızca metinde geçen [Kanıt N] gibi düz metinler gerçek atıf sayılmaz;
 * <a> etiketinde data-evidence-id veya href doğrulaması zorunludur.
 */
export function isEvidenceLinkedInHtml(html: string | null | undefined, evidence: KanitDosyasi): boolean {
  if (!html || !evidence) return false;
  const links = extractEvidenceLinks(html);
  if (links.length === 0) return false;

  const evId = (evidence.evidence_id || evidence.id || '').trim();
  const evUrl = (evidence.url || evidence.dosya_url || '').trim();
  const evAnnotatedUrl = (evidence.annotated_url || '').trim();
  const evStoragePath = (evidence.storagePath || '').trim();

  // Kanıt nesnesinin ait olduğu kesin bucket'ı belirle
  const urlRef = parseStorageReference(evUrl) || parseStorageReference(evAnnotatedUrl);
  const evBucket = (evidence.bucket || urlRef?.bucket || 'dokumanlar').trim();
  const evHasUrl = Boolean(evUrl || evAnnotatedUrl || evStoragePath);

  return links.some(link => {
    const linkHref = link.href?.trim();
    const linkHasHref = Boolean(linkHref && linkHref !== '#');

    // 1. Eğer bağlantıda href varsa ve kanıtın URL'si belliyse:
    if (linkHasHref && evHasUrl) {
      const matchesHref = Boolean(
        (evUrl && urlsMatch(linkHref, evUrl, evBucket)) ||
        (evAnnotatedUrl && urlsMatch(linkHref, evAnnotatedUrl, evBucket)) ||
        (evStoragePath && urlsMatch(linkHref, evStoragePath, evBucket))
      );
      // Href mevcut ama kanıtın URL/bucket'ı ile eşleşmiyorsa (örn. yanlış bucket kanit_dosyalari vs dokumanlar):
      // data-evidence-id eşleşse dahi bu bağlantı YANLIŞ hedefe işaret etmektedir, KESİNLİKLE REDDEDİLİR!
      if (!matchesHref) {
        return false;
      }
    }

    // 2. Eğer hem bağlantıda hem kanıtta evidence_id varsa ve uyuşmuyorsa REDDET!
    if (link.evidenceId && evId && link.evidenceId !== evId) {
      return false;
    }

    // 3. Eşleşme kabulü
    if (linkHasHref && evHasUrl) {
      return true; // matchesHref true ve ID çelişkisi yok
    }

    if (link.evidenceId && evId && link.evidenceId === evId) {
      return true;
    }

    return false;
  });
}

/**
 * Ölçüt bazlı PUKÖ - ÖDR Stres Testini çalıştırır.
 */
export function calistirPukoStresTesti(params: {
  altOlcutler: AltOlcut[];
  pukoListesi: PukoKayit[];
  odrListesi: OdrKayit[];
}): StresTestiSonucu {
  const { altOlcutler, pukoListesi, odrListesi } = params;

  const odrMap = new Map<string, OdrKayit>();
  odrListesi.forEach(odr => {
    odrMap.set(String(odr.alt_olcut_id), odr);
  });

  const pukoByOlcut = new Map<string, PukoKayit[]>();
  pukoListesi.forEach(p => {
    const key = String(p.alt_olcut_id);
    if (!pukoByOlcut.has(key)) {
      pukoByOlcut.set(key, []);
    }
    pukoByOlcut.get(key)!.push(p);
  });

  const odrAlinmamisOlcutler: OdrAlinmamisOlcut[] = [];
  const asamadaVarOdrdeYok: AsamadaVarOdrdeYokKanit[] = [];
  const bosAsamalar: BosAsama[] = [];
  const ingilizceOdrSorunlari: IngilizceOdrSorunu[] = [];

  altOlcutler.forEach(olcut => {
    const key = String(olcut.id);
    const odr = odrMap.get(key);
    const pukoStages = pukoByOlcut.get(key) || [];

    // 1. ÖDR'ye Alınmamış Ölçüt Kontrolü
    const hasValidOdr = odr && !isHtmlContentEmpty(odr.icerik);
    if (!hasValidOdr) {
      let kanitSayisi = 0;
      let asamaSayisi = 0;
      pukoStages.forEach(p => {
        if (!isHtmlContentEmpty(p.aciklama) || (p.kanit_dosyalari && p.kanit_dosyalari.length > 0)) {
          asamaSayisi++;
        }
        if (p.kanit_dosyalari && Array.isArray(p.kanit_dosyalari)) {
          kanitSayisi += p.kanit_dosyalari.length;
        }
      });

      odrAlinmamisOlcutler.push({
        alt_olcut_id: olcut.id,
        kod: olcut.kod,
        olcut_adi: olcut.olcut_adi,
        puko_asama_sayisi: asamaSayisi,
        puko_kanit_sayisi: kanitSayisi,
      });
    }

    // 2. Aşamalarda Kanıt Var, ÖDR'de Yok Kontrolü
    const odrKanitlar = Array.isArray(odr?.kanitlar) ? odr.kanitlar : [];
    const odrIcerik = odr?.icerik || '';

    pukoStages.forEach(p => {
      if (p.kanit_dosyalari && Array.isArray(p.kanit_dosyalari)) {
        p.kanit_dosyalari.forEach(k => {
          const rawUrl = (k.url || k.dosya_url || k.storagePath || '').trim();
          const cleanName = (k.name || k.dosya_adi || '').trim();
          if (!rawUrl && !cleanName) return;

          const kRef = parseStorageReference(k.url || k.dosya_url);
          const kBucket = (k.bucket || kRef?.bucket || 'dokumanlar').trim();

          // ÖDR kanıt listesinde (odr.kanitlar) var mı? (Yalnızca evidence_id veya tam URL eşleşmesi)
          const kEvId = (k.evidence_id || k.id || '').trim();
          const inOdrList = odrKanitlar.some((ok: any) => {
            const okUrl = (ok.url || ok.dosya_url || ok.storagePath || '').trim();
            const okEvId = (ok.evidence_id || ok.id || '').trim();

            // 1. Eğer hem PUKÖ kanıtında hem de ÖDR kanıtında URL varsa:
            if (rawUrl && okUrl) {
              const urlMatches = urlsMatch(rawUrl, okUrl, kBucket);
              // URL veya bucket uyuşmuyorsa, evidence_id aynı olsa dahi YANLIŞ / FARKLI dosyadır -> REDDET!
              if (!urlMatches) {
                return false;
              }
              // URL eşleşti; eğer ikisinde de ID varsa ve ID'ler çelişiyorsa -> REDDET!
              if (kEvId && okEvId && kEvId !== okEvId) {
                return false;
              }
              return true;
            }

            // 2. URL'lerden biri yoksa (yalnızca ID üzerinden aktarılmış kayıtlar):
            if (kEvId && okEvId && kEvId === okEvId) {
              return true;
            }

            // 3. ID yoksa ama URL varsa:
            if (rawUrl && okUrl && urlsMatch(rawUrl, okUrl, kBucket)) {
              return true;
            }

            return false;
          });

          // ÖDR HTML içeriğinde gerçek bir kanıt bağlantısı (<a data-evidence-id="..." veya href="...">) var mı?
          const inOdrHtml = isEvidenceLinkedInHtml(odrIcerik, k);

          if (!inOdrList && !inOdrHtml) {
            asamadaVarOdrdeYok.push({
              alt_olcut_id: olcut.id,
              kod: olcut.kod,
              olcut_adi: olcut.olcut_adi,
              puko_asamasi: p.puko_asamasi,
              kanit_adi: cleanName || rawUrl.split('/').pop() || 'Kanıt Dosyası',
              kanit_url: rawUrl,
            });
          }
        });
      }
    });

    // 3. Boş Aşamalar Kontrolü (PUKÖ 4 aşaması kontrol edilir)
    PUKO_KONTROL_ASAMALARI.forEach(asama => {
      const record = pukoStages.find(p => p.puko_asamasi === asama);
      const isEmpty = !record || (isHtmlContentEmpty(record.aciklama) && (!record.kanit_dosyalari || record.kanit_dosyalari.length === 0));

      if (isEmpty) {
        bosAsamalar.push({
          alt_olcut_id: olcut.id,
          kod: olcut.kod,
          olcut_adi: olcut.olcut_adi,
          puko_asamasi: asama,
          asama_adi: ASAMA_ISIMLERI[asama] || asama,
          durum_aciklamasi: !record ? 'Kayıt bulunmuyor' : 'Açıklama ve kanıt boş',
        });
      }
    });

    // 4. İngilizce ÖDR Kontrolleri (Ölçütün ÖDR kaydı mevcutsa)
    if (odr) {
      const enIssues = denetleIngilizceOdr({
        altOlcutId: olcut.id,
        kod: olcut.kod,
        olcutAdi: olcut.olcut_adi,
        icerikTr: odr.icerik,
        icerikEn: odr.icerik_en,
        kanitlar: odr.kanitlar,
        pukoStages: pukoStages,
      });
      ingilizceOdrSorunlari.push(...enIssues);
    }
  });

  return {
    odrAlinmamisOlcutler,
    asamadaVarOdrdeYok,
    bosAsamalar,
    ingilizceOdrSorunlari,
    toplamSorun: odrAlinmamisOlcutler.length + asamadaVarOdrdeYok.length + bosAsamalar.length + ingilizceOdrSorunlari.length,
  };
}

/**
 * Tekil PUKÖ aşaması düzenlenirken geri bildirim verir (PhaseClient uyumluluğu için korunmuştur).
 */
export function degerlendirTekAsama(params: {
  altOlcutId: number | string;
  kod: string;
  olcutAdi: string;
  pukoAsamasi: string;
  aciklama: string | null | undefined;
  kanitDosyalari: KanitDosyasi[] | null | undefined;
}): {
  isEmpty: boolean;
  isTextWithoutEvidence: boolean;
  uncitedEvidences: Array<{ kanit_no: string | number; dosya_adi: string }>;
} {
  const { aciklama, kanitDosyalari } = params;
  const emptyText = isHtmlContentEmpty(aciklama);
  const evidenceList = Array.isArray(kanitDosyalari) ? kanitDosyalari : [];
  const hasEvidence = evidenceList.length > 0;

  if (emptyText && !hasEvidence) {
    return { isEmpty: true, isTextWithoutEvidence: false, uncitedEvidences: [] };
  }

  if (!emptyText && !hasEvidence) {
    return { isEmpty: false, isTextWithoutEvidence: true, uncitedEvidences: [] };
  }

  const html = aciklama || '';
  const uncited: Array<{ kanit_no: string | number; dosya_adi: string }> = [];

  evidenceList.forEach((e, idx) => {
    const n = e.evidence_no ?? (idx + 1);
    const fileName = e.name || e.dosya_adi || `Kanıt ${n}`;
    // HTML'deki bağlantıyı data-evidence-id veya tam href ile doğrula
    const hasCitation = isEvidenceLinkedInHtml(html, e);
    if (!hasCitation) {
      uncited.push({ kanit_no: n, dosya_adi: fileName });
    }
  });

  return {
    isEmpty: false,
    isTextWithoutEvidence: false,
    uncitedEvidences: uncited,
  };
}

/**
 * İngilizce ÖDR içeriğini denetler:
 * 1. İngilizce içerik boşsa veya Türkçe metinle aynıysa tespit eder.
 * 2. [Evidence N] bağlantısı yalnızca herhangi bir kanıta değil, kanitlar listesindeki N'inci kanıta (1-based: N-1) bağlanmalı;
 *    bağlantının URL'si de o kaydın URL'siyle eşleşmeli.
 */
export function denetleIngilizceOdr(params: {
  altOlcutId: number | string;
  kod: string;
  olcutAdi: string;
  icerikTr: string | null | undefined;
  icerikEn: string | null | undefined;
  kanitlar: any[] | null | undefined;
  pukoStages?: PukoKayit[] | null;
}): IngilizceOdrSorunu[] {
  const { altOlcutId, kod, olcutAdi, icerikTr, icerikEn, kanitlar, pukoStages } = params;

  const issues: IngilizceOdrSorunu[] = [];
  const hasTrContent = !isHtmlContentEmpty(icerikTr);
  const isEnEmpty = isHtmlContentEmpty(icerikEn);

  // 1. Kontrol: İngilizce ÖDR içeriği boşsa veya anlamlı Türkçe ÖDR metniyle boşluklar ve HTML etiketleri temizlendikten sonra aynıysa
  if (hasTrContent) {
    if (isEnEmpty) {
      issues.push({
        alt_olcut_id: altOlcutId,
        kod,
        olcut_adi: olcutAdi,
        sorun_tipi: 'bos_veya_kopyalanmis',
        aciklama: 'İngilizce ÖDR metni girilmemiş (boş bırakılmış).',
      });
      return issues;
    }

    const normTr = normalizeHtmlForComparison(icerikTr);
    const normEn = normalizeHtmlForComparison(icerikEn);

    // Durum A: Düzenlenmiş Türkçe ÖDR metni ile birebir aynıysa
    if (normTr.length > 0 && normTr === normEn) {
      issues.push({
        alt_olcut_id: altOlcutId,
        kod,
        olcut_adi: olcutAdi,
        sorun_tipi: 'bos_veya_kopyalanmis',
        aciklama: 'İngilizce ÖDR eksik veya Türkçe metin kopyalanmış.',
      });
      return issues;
    }

    // Durum B: Hoca Türkçe kısmı düzenlemiş olsa bile, İngilizce kısım PUKÖ aşamalarından çekilen ham Türkçe metin olarak bırakılmışsa
    if (pukoStages && pukoStages.length > 0) {
      const orderMap: Record<string, number> = { planlama: 1, uygulama: 2, kontrol: 3, onlem: 4, olgunluk: 5 };
      const sortedStages = [...pukoStages].sort(
        (a, b) => (orderMap[a.puko_asamasi] || 99) - (orderMap[b.puko_asamasi] || 99)
      );
      let rawPukoCombined = '';
      sortedStages.forEach(p => {
        if (p.aciklama && !isHtmlContentEmpty(p.aciklama)) {
          rawPukoCombined += (rawPukoCombined ? ' ' : '') + p.aciklama;
        }
      });

      const stripTagsAndEv = (str: string) =>
        normalizeHtmlForComparison(str)
          .replace(/\[\s*kan[ıi]t\s*\d+\s*\]/gi, '')
          .replace(/\[\s*evidence\s*\d+\s*\]/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

      const pukoStripped = stripTagsAndEv(rawPukoCombined);
      const enStripped = stripTagsAndEv(icerikEn || '');

      if (pukoStripped.length > 0 && enStripped === pukoStripped) {
        issues.push({
          alt_olcut_id: altOlcutId,
          kod,
          olcut_adi: olcutAdi,
          sorun_tipi: 'bos_veya_kopyalanmis',
          aciklama: 'İngilizce ÖDR çevrilmemiş (PUKÖ aşamalarından çekilen ham Türkçe metin bırakılmış).',
        });
        return issues;
      }
    }
  }

  if (isEnEmpty) {
    return issues;
  }

  // 2. Kontrol: İngilizce metindeki kanıt atıflarını ([Evidence N] veya [Kanıt N]) denetle
  const htmlEn = icerikEn || '';
  
  // ÖDR'deki kanıtlar ve PUKÖ aşamalarındaki kanıtları birleştir
  const rawOdrKanitlar = Array.isArray(kanitlar) ? kanitlar : [];
  const pukoKanitlar: any[] = [];
  if (pukoStages && Array.isArray(pukoStages)) {
    const orderMap: Record<string, number> = { planlama: 1, uygulama: 2, kontrol: 3, onlem: 4, iyilestirme: 4, olgunluk: 5 };
    const sortedStages = [...pukoStages].sort((a, b) => (orderMap[a.puko_asamasi?.toLowerCase()] || 99) - (orderMap[b.puko_asamasi?.toLowerCase()] || 99));
    
    sortedStages.forEach(st => {
      if (Array.isArray(st.kanit_dosyalari)) {
        st.kanit_dosyalari.forEach(k => {
          if (k) pukoKanitlar.push(k);
        });
      }
    });
  }

  // ÖDR + PUKÖ birleşik kanıt havuzu
  const combinedEvidenceList: any[] = [...rawOdrKanitlar];
  pukoKanitlar.forEach(pk => {
    const pkUrl = (pk.url || pk.dosya_url || pk.storagePath || '').trim();
    const pkId = (pk.evidence_id || pk.id || '').trim();
    const alreadyExists = combinedEvidenceList.some(e => {
      const eUrl = (e.url || e.dosya_url || e.storagePath || '').trim();
      const eId = (e.evidence_id || e.id || '').trim();
      if (pkId && eId && pkId === eId) return true;
      if (pkUrl && eUrl && (pkUrl === eUrl || urlsMatch(pkUrl, eUrl))) return true;
      return false;
    });
    if (!alreadyExists) {
      combinedEvidenceList.push(pk);
    }
  });

  const anchorLinks = extractEvidenceLinks(htmlEn);

  // Metindeki tüm [Evidence N] ve [Kanıt N] ifadelerini regex ile tara
  const citationRegex = /\[\s*(?:Evidence|Kan[ıi]t)\s*(\d+)\s*\]/gi;
  const mentionedNumbers = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = citationRegex.exec(htmlEn)) !== null) {
    mentionedNumbers.add(parseInt(match[1], 10));
  }

  // Anchor etiketleri dışındaki düz metin [Evidence N] ve [Kanıt N] ifadelerini tespit et
  // Çok satırlı bağlantıları da temizleyebilmek için [\s\S]*? deseni kullanılır
  const textWithoutAnchors = htmlEn.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ');
  const plainTextNumbers = new Set<number>();
  let plainMatch: RegExpExecArray | null;
  while ((plainMatch = citationRegex.exec(textWithoutAnchors)) !== null) {
    plainTextNumbers.add(parseInt(plainMatch[1], 10));
  }

  const missingEvidenceLabels: string[] = [];

  mentionedNumbers.forEach(evNum => {
    // 1. Hedef kanıt nesnesini bul:
    // Sırasıyla e.no === evNum, e.evidence_no === evNum veya 1-based index (evNum - 1)
    const targetIdx = evNum - 1;
    const nThEvidence = 
      combinedEvidenceList.find(e => Number(e.no) === evNum || Number(e.evidence_no) === evNum) ||
      (targetIdx >= 0 && targetIdx < combinedEvidenceList.length ? combinedEvidenceList[targetIdx] : null) ||
      pukoKanitlar.find(e => Number(e.no) === evNum || Number(e.evidence_no) === evNum) ||
      (targetIdx >= 0 && targetIdx < pukoKanitlar.length ? pukoKanitlar[targetIdx] : null);

    if (!nThEvidence) {
      // Kanıt listesinde N'inci kanıt kaydı yok!
      missingEvidenceLabels.push(`[Evidence ${evNum}]`);
      return;
    }

    const evUrl = (nThEvidence.url || nThEvidence.dosya_url || '').trim();
    const evAnnotatedUrl = (nThEvidence.annotated_url || '').trim();
    const evStoragePath = (nThEvidence.storagePath || '').trim();
    const evId = (nThEvidence.evidence_id || nThEvidence.id || '').trim();
    const urlRef = parseStorageReference(evUrl) || parseStorageReference(evAnnotatedUrl);
    const evBucket = (nThEvidence.bucket || urlRef?.bucket || 'dokumanlar').trim();
    const evHasUrl = Boolean(evUrl || evAnnotatedUrl || evStoragePath);

    // 2. Bu kanıt numarasına ait geçerli bir bağlantı var mı?
    // Hem EN düğmesiyle eklenen [Evidence N] hem de TR/PUKÖ kaynaklı [Kanıt N] bağlantıları kabul edilir.
    // Ayrıca bağlantı doğrudan bu kanıtın hedefine gidiyorsa veya ID'si eşleşiyorsa da kabul edilir.
    const hasValidLink = anchorLinks.some(link => {
      const linkText = link.text || '';
      const textMatches = new RegExp(`\\[?\\s*(?:Evidence|Kan[ıi]t)\\s*${evNum}\\b`, 'i').test(linkText);

      const linkHref = link.href?.trim();
      const linkHasHref = Boolean(linkHref && linkHref !== '#');

      // 1. Bağlantı metninde Evidence N veya Kanıt N geçiyorsa:
      if (textMatches) {
        if (linkHasHref && evHasUrl) {
          const matchesHref = Boolean(
            (evUrl && urlsMatch(linkHref, evUrl, evBucket)) ||
            (evAnnotatedUrl && urlsMatch(linkHref, evAnnotatedUrl, evBucket)) ||
            (evStoragePath && urlsMatch(linkHref, evStoragePath, evBucket))
          );
          if (matchesHref) return true;
        }
        if (link.evidenceId && evId && link.evidenceId === evId) {
          return true;
        }
        if (linkHasHref && !evHasUrl) {
          return true;
        }
      }

      // 2. Bağlantı metninde numara yazmasa bile doğrudan bu kanıtın ID veya URL'sine gidiyorsa:
      if (link.evidenceId && evId && link.evidenceId === evId) {
        return true;
      }
      if (linkHasHref && evHasUrl) {
        const matchesHref = Boolean(
          (evUrl && urlsMatch(linkHref, evUrl, evBucket)) ||
          (evAnnotatedUrl && urlsMatch(linkHref, evAnnotatedUrl, evBucket)) ||
          (evStoragePath && urlsMatch(linkHref, evStoragePath, evBucket))
        );
        if (matchesHref) {
          return true;
        }
      }

      return false;
    });

    if (!hasValidLink) {
      missingEvidenceLabels.push(`[Evidence ${evNum}]`);
    }
  });

  if (missingEvidenceLabels.length > 0) {
    const uniqueLabels = Array.from(new Set(missingEvidenceLabels)).sort();
    issues.push({
      alt_olcut_id: altOlcutId,
      kod,
      olcut_adi: olcutAdi,
      sorun_tipi: 'kanit_baglantisi_eksik',
      aciklama: `İngilizce ÖDR’de kanıt bağlantısı eksik veya yanlış eşleşmiş (${uniqueLabels.join(', ')}).`,
      eksik_kanitlar: uniqueLabels,
    });
  }

  return issues;
}

/**
 * Tekil ÖDR kaydı kaydedildiğinde bilgilendirici kontrol yapar (kaydı engellemez).
 */
export function degerlendirTekOdr(params: {
  altOlcutId: number | string;
  kod: string;
  olcutAdi: string;
  icerikTr: string | null | undefined;
  icerikEn: string | null | undefined;
  kanitlar: any[] | null | undefined;
  pukoStages?: PukoKayit[] | null;
}): {
  hasIssue: boolean;
  warningMessage: string | null;
  issues: IngilizceOdrSorunu[];
} {
  const issues = denetleIngilizceOdr(params);
  if (issues.length === 0) {
    return { hasIssue: false, warningMessage: null, issues: [] };
  }

  const primaryIssue = issues[0];
  let warningMessage = primaryIssue.aciklama;
  if (primaryIssue.sorun_tipi === 'bos_veya_kopyalanmis') {
    warningMessage = 'Stres Testi Bilgilendirmesi: İngilizce ÖDR içeriği henüz girilmemiş veya Türkçe metinle aynı bırakılmış.';
  } else if (primaryIssue.sorun_tipi === 'kanit_baglantisi_eksik') {
    const labels = primaryIssue.eksik_kanitlar?.join(', ') || '';
    warningMessage = `Stres Testi Bilgilendirmesi: İngilizce ÖDR metninde ${labels} için geçerli kanıt bağlantısı bulunamadı veya yanlış numaraya bağlanmış.`;
  }

  return {
    hasIssue: true,
    warningMessage,
    issues,
  };
}
