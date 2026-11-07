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
  durum_aciklamasi?: string;
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
  sorun_tipi: 'bos_veya_kopyalanmis' | 'kanit_baglantisi_eksik' | 'mukerrer_kanit' | 'parite_eksik_kanit' | 'sira_kopuklugu';
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
 * [Kanıt N] ve [Evidence N] atıflarını zengin metin düzenleyicilerin (TipTap vb.)
 * böldüğü etiketlerden (örn. [Evidence <strong>4</strong>] veya <a...>[</a>Evidence 4])
 * arındırıp doğru okumak için HTML etiketlerini ve özel boşlukları temizler.
 */
export function normalizeHtmlForCitation(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
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
/**
 * Bir <a> bağlantısının verilen kanıt nesnesine işaret edip etmediğini kesin kurallarla doğrular.
 * - Kanıt kaydında beklenen URL biliniyorsa, anchor'ın href'i bu URL ile eşleşmeli.
 *   data-evidence-id eşleşmesi, bilinen ama farklı bir href'i geçerli kılmaz.
 * - Kanıt kaydında URL yoksa, rastgele dolu bir href geçerli sayılmaz; yalnızca beklenen kanıtın kararlı ID'siyle doğrulanırsa kabul edilir.
 * - ID ve URL birlikte mevcutsa çelişen ID veya href reddedilir.
 */
export function doesAnchorMatchEvidence(
  link: HtmlEvidenceLink,
  evidence: KanitDosyasi
): { matches: boolean; hasConflict: boolean } {
  const linkHref = link.href?.trim();
  const linkHasHref = Boolean(linkHref && linkHref !== '#');
  const linkEvId = link.evidenceId?.trim();

  // Tıklanabilir bağlantı olması için <a> etiketinde MUTLAKA geçerli bir href bulunmalıdır (# veya boş olamaz).
  // href yoksa bağlantı sayılmaz ve hedef uyuşmazlığı hatası üretilmez.
  if (!linkHasHref) {
    return { matches: false, hasConflict: false };
  }

  const evUrl = (evidence.url || evidence.dosya_url || '').trim();
  const evAnnotatedUrl = (evidence.annotated_url || '').trim();
  const evStoragePath = (evidence.storagePath || '').trim();
  const evId = (evidence.evidence_id || evidence.id || '').trim();

  // 1. Kararlı ID kontrolü: İki tarafta da ID varsa ve uyuşmuyorsa doğrudan çelişkidir, REDDET!
  if (linkEvId && evId && linkEvId !== evId) {
    return { matches: false, hasConflict: true };
  }

  // Kanıt nesnesinin ait olduğu kesin bucket'ı belirle
  const urlRef = parseStorageReference(evUrl) || parseStorageReference(evAnnotatedUrl);
  const evBucket = (evidence.bucket || urlRef?.bucket || 'dokumanlar').trim();
  const evHasUrl = Boolean(evUrl || evAnnotatedUrl || evStoragePath);

  // 2. Kanıt kaydında beklenen URL biliniyorsa:
  if (evHasUrl) {
    const matchesHref = Boolean(
      (evUrl && urlsMatch(linkHref, evUrl, evBucket)) ||
      (evAnnotatedUrl && urlsMatch(linkHref, evAnnotatedUrl, evBucket)) ||
      (evStoragePath && urlsMatch(linkHref, evStoragePath, evBucket))
    );
    if (!matchesHref) {
      // Beklenen URL var ama linkteki href farklı -> data-evidence-id eşleşse dahi REDDET!
      return { matches: false, hasConflict: true };
    }
    // URL eşleşti ve ID çelişkisi yok
    return { matches: true, hasConflict: false };
  }

  // 3. Kanıt kaydında URL yoksa:
  // Tıklanabilir olması için geçerli bir href şartı en başta doğrulandı.
  // Yalnızca beklenen kanıtın kararlı ID'siyle doğrulanabiliyorsa kabul et.
  if (evId && linkEvId && linkEvId === evId) {
    return { matches: true, hasConflict: false };
  }

  return { matches: false, hasConflict: false };
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

  return links.some(link => doesAnchorMatchEvidence(link, evidence).matches);
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
    const odrIcerik = odr?.icerik || '';
    const cleanNormalizedTr = normalizeHtmlForCitation(odrIcerik);
    const allStageEvidences: KanitDosyasi[] = [];
    pukoStages.forEach(p => {
      if (p.kanit_dosyalari && Array.isArray(p.kanit_dosyalari)) {
        p.kanit_dosyalari.forEach(k => {
          if (k) allStageEvidences.push(k);
        });
      }
    });

    // PUKÖ aşamalarını OzdegerlendirmeRaporuClient.tsx içindeki sırayla sırala:
    // Sıralama kuralı: planlama, uygulama, kontrol, onlem, olgunluk
    const orderMap: Record<string, number> = { planlama: 1, uygulama: 2, kontrol: 3, onlem: 4, olgunluk: 5 };
    const siraliPukoStages = [...pukoStages].sort(
      (a, b) => (orderMap[a.puko_asamasi?.toLowerCase()] || 99) - (orderMap[b.puko_asamasi?.toLowerCase()] || 99)
    );

    // Tek bir global sayaç ve ÖDR ekranıyla birebir aynı tekilleştirme kuralı:
    // URL mevcutsa eşleştir, URL'siz nesneleri tekilleştirme
    let localEvidenceCounter = 1;
    const birlesikKanitlar: any[] = [];
    const pukoKanitKanonikMap = new Map<KanitDosyasi, number>();

    siraliPukoStages.forEach(p => {
      if (p.kanit_dosyalari && Array.isArray(p.kanit_dosyalari)) {
        p.kanit_dosyalari.forEach((k: any) => {
          if (!k) return;
          let ev = k.url ? birlesikKanitlar.find(e => Boolean(e.url) && e.url === k.url) : null;
          if (!ev) {
            ev = { ...k, no: localEvidenceCounter++ };
            birlesikKanitlar.push(ev);
          }
          pukoKanitKanonikMap.set(k, ev.no);
        });
      }
    });

    siraliPukoStages.forEach(p => {
      if (p.kanit_dosyalari && Array.isArray(p.kanit_dosyalari)) {
        p.kanit_dosyalari.forEach(k => {
          const rawUrl = (k.url || k.dosya_url || k.storagePath || '').trim();
          const cleanName = (k.name || k.dosya_adi || '').trim();
          if (!rawUrl && !cleanName) return;

          // Kanonik global kanıt numarası (k.no veya k.evidence_no önüne GEÇİRİLMEZ):
          const evNum = pukoKanitKanonikMap.get(k) ?? k.no ?? k.evidence_no;

          // 1. Tıklanabilir <a> bağlantısı kontrolü
          const hasAnchorLink =
            isEvidenceLinkedInHtml(odrIcerik, k) ||
            (Boolean(cleanName) &&
              allStageEvidences.some(
                otherK =>
                  otherK !== k &&
                  (otherK.name || otherK.dosya_adi || '').trim() === cleanName &&
                  isEvidenceLinkedInHtml(odrIcerik, otherK)
              ));

          // 2. Düz metin atfı kontrolü (örneğin: "[Kanıt 1]", "Kanıt 1: Karar", "Kanıt 1 olarak eklenmiştir", veya açık dosya adı)
          const hasPlainTextCitation =
            Boolean(evNum && new RegExp(`\\bKan[ıi]t\\s*${evNum}\\b`, 'i').test(cleanNormalizedTr)) ||
            (Boolean(cleanName) && cleanNormalizedTr.toLowerCase().includes(cleanName.toLowerCase()));

          const inOdrHtml = hasAnchorLink || hasPlainTextCitation;

          if (!inOdrHtml) {
            const stageDescEmpty = isHtmlContentEmpty(p.aciklama);
            const asamaAdi = ASAMA_ISIMLERI[p.puko_asamasi] || p.puko_asamasi;
            const durumAciklamasi = stageDescEmpty
              ? `${asamaAdi} aşamasında açıklama girilmediği için kanıt ÖDR metnine otomatik aktarılamamıştır. Tablodaki '+ TR' / '+ EN' butonunu kullanarak kanıtı metne ekleyin.`
              : `PUKÖ aşamasında yüklenen bu kanıt ÖDR metninde yer almamaktadır. Tablodaki '+ TR' butonuna basarak metne ekleyin veya yukarıdaki 'Verileri Yeniden Çek' butonunu kullanın.`;

            asamadaVarOdrdeYok.push({
              alt_olcut_id: olcut.id,
              kod: olcut.kod,
              olcut_adi: olcut.olcut_adi,
              puko_asamasi: p.puko_asamasi,
              kanit_adi: cleanName || rawUrl.split('/').pop() || 'Kanıt Dosyası',
              kanit_url: rawUrl,
              durum_aciklamasi: durumAciklamasi,
            });
          }
        });
      }
    });

    // 3. İngilizce ÖDR Kontrolleri (Ölçütün ÖDR kaydı mevcutsa)
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
    toplamSorun: odrAlinmamisOlcutler.length + asamadaVarOdrdeYok.length + ingilizceOdrSorunlari.length,
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

  // Aşamaya kanıt belgesi yükleme zorunluluğu yoktur; açıklama metni tek başına tam geçerlidir.
  if (!emptyText && !hasEvidence) {
    return { isEmpty: false, isTextWithoutEvidence: false, uncitedEvidences: [] };
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

    const stripTagsAndEv = (str: string | null | undefined) =>
      normalizeHtmlForComparison(str)
        .replace(/\[\s*kan[ıi]t\s*\d+\s*\]/gi, '')
        .replace(/\[\s*evidence\s*\d+\s*\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normTr = normalizeHtmlForComparison(icerikTr);
    const normEn = normalizeHtmlForComparison(icerikEn);
    const trStripped = stripTagsAndEv(icerikTr);
    const enStripped = stripTagsAndEv(icerikEn);

    // Durum A: Düzenlenmiş Türkçe ÖDR metni ile ([Kanıt N] atıfları olsa da olmasa da) birebir aynıysa
    if ((normTr.length > 0 && normTr === normEn) || (trStripped.length > 0 && trStripped === enStripped)) {
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

      const pukoStripped = stripTagsAndEv(rawPukoCombined);

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
  
  // PUKÖ aşamalarını OzdegerlendirmeRaporuClient.tsx içindeki sırayla sırala ve kanonik kanıt listesini oluştur
  const canonicalEvidenceList: any[] = [];
  let localEvidenceCounter = 1;

  if (pukoStages && Array.isArray(pukoStages)) {
    const orderMap: Record<string, number> = { planlama: 1, uygulama: 2, kontrol: 3, onlem: 4, iyilestirme: 4, olgunluk: 5 };
    const sortedStages = [...pukoStages].sort(
      (a, b) => (orderMap[a.puko_asamasi?.toLowerCase()] || 99) - (orderMap[b.puko_asamasi?.toLowerCase()] || 99)
    );
    sortedStages.forEach(st => {
      if (Array.isArray(st.kanit_dosyalari)) {
        st.kanit_dosyalari.forEach((k: any) => {
          if (!k) return;
          let ev = k.url
            ? canonicalEvidenceList.find(e => Boolean(e.url) && e.url === k.url)
            : null;
          if (!ev) {
            ev = { ...k, no: localEvidenceCounter++ };
            canonicalEvidenceList.push(ev);
          }
        });
      }
    });
  }

  // ÖDR kaydındaki kanıtlar listesinde olup PUKÖ'de olmayan ek kanıtlar varsa ekle
  const rawOdrKanitlar = Array.isArray(kanitlar) ? kanitlar : [];
  rawOdrKanitlar.forEach((ok: any) => {
    if (!ok) return;
    let ev = ok.url
      ? canonicalEvidenceList.find(e => Boolean(e.url) && e.url === ok.url)
      : null;
    if (!ev) {
      const assignedNo = typeof ok.no === 'number' ? ok.no : localEvidenceCounter++;
      ev = { ...ok, no: assignedNo };
      canonicalEvidenceList.push(ev);
    }
  });

  // Türkçe ÖDR metninde geçen kanıt numaralarını etiketlerden arındırılmış metin üzerinden dinamik olarak tespit et
  const trNormalized = normalizeHtmlForCitation(icerikTr);
  const trCitationRegex = /\bKan[ıi]t\s*(\d+)\b/gi;
  const trCitedNumbers = new Set<number>();
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trCitationRegex.exec(trNormalized)) !== null) {
    trCitedNumbers.add(parseInt(trMatch[1], 10));
  }

  const anchorLinks = extractEvidenceLinks(htmlEn);

  // Metindeki tüm [Evidence N] ve [Kanıt N] (ve düz cümle içi "Evidence N", "Kanıt N") ifadelerini tara
  const enNormalized = normalizeHtmlForCitation(htmlEn);
  const citationRegex = /\b(?:Evidence|Kan[ıi]t)\s*(\d+)\b/gi;
  const enFrequencies = new Map<number, number>();
  let match: RegExpExecArray | null;
  while ((match = citationRegex.exec(enNormalized)) !== null) {
    const num = parseInt(match[1], 10);
    enFrequencies.set(num, (enFrequencies.get(num) || 0) + 1);
  }

  // 1. Mükerrerlik Sayacı: Yalnızca kanıt numarasıyla ilişkilendirilebilen tıklanabilir <a> bağlantılarını say.
  // Her <a> etiketi aynı numarayı içinde birden fazla yazsa bile en fazla 1 sayılır (Set kullanımı).
  const anchorEvidenceCounts = new Map<number, number>();
  const wrongTargetAnchorNums = new Set<number>();

  anchorLinks.forEach(link => {
    const numsInThisAnchor = new Set<number>();
    const linkText = link.text || '';
    const linkHref = link.href?.trim();
    const linkHasHref = Boolean(linkHref && linkHref !== '#');
    const labelRegex = /\b(?:Evidence|Kan[ıi]t)\s*(\d+)\b/gi;
    let labelMatch: RegExpExecArray | null;
    let foundAnyLabel = false;

    while ((labelMatch = labelRegex.exec(linkText)) !== null) {
      foundAnyLabel = true;
      const num = parseInt(labelMatch[1], 10);
      const targetEv =
        canonicalEvidenceList.find(e => Number(e.no) === num) ||
        (num > 0 && num <= canonicalEvidenceList.length ? canonicalEvidenceList[num - 1] : null);

      if (targetEv) {
        const { matches, hasConflict } = doesAnchorMatchEvidence(link, targetEv);
        if (matches) {
          numsInThisAnchor.add(num);
        } else if (hasConflict && linkHasHref) {
          // Yalnızca geçerli bir href mevcutken ve hedef uyuşmazlığı varsa wrongTargetAnchorNums'a ekle!
          // href yoksa tıklanabilir bağlantı değildir; düz yazı atfını sahte hedef hatasına dönüştürme.
          wrongTargetAnchorNums.add(num);
        }
      } else {
        // Havuzda bu numaraya karşılık gelen bir kayıt yok
        if (linkHasHref) {
          wrongTargetAnchorNums.add(num);
        }
      }
    }

    if (!foundAnyLabel) {
      // Görünen etiket yoksa data-evidence-id veya href'in kanıt havuzundaki karşılığından belirle
      canonicalEvidenceList.forEach(ev => {
        const num = Number(ev.no);
        if (!num) return;
        const { matches } = doesAnchorMatchEvidence(link, ev);
        if (matches) {
          numsInThisAnchor.add(num);
        }
      });
    }

    numsInThisAnchor.forEach(num => {
      anchorEvidenceCounts.set(num, (anchorEvidenceCounts.get(num) || 0) + 1);
    });
  });

  // İki ayrı tıklanabilir bağlantı aynı kanıt numarasına gidiyorsa mükerrer uyarısı üret:
  anchorEvidenceCounts.forEach((count, num) => {
    if (count > 1) {
      issues.push({
        alt_olcut_id: altOlcutId,
        kod,
        olcut_adi: olcutAdi,
        sorun_tipi: 'mukerrer_kanit',
        aciklama: `İngilizce ÖDR metninde [Evidence ${num}] için ${count} ayrı tıklanabilir bağlantı eklenmiştir (mükerrer bağlantı).`,
        eksik_kanitlar: [`[Evidence ${num}]`],
      });
    }
  });

  // 2. Parite Denetimi: Türkçe raporda atıf alan kanıtların İngilizce metinde bulunması zorunludur
  trCitedNumbers.forEach(trNum => {
    if (!enFrequencies.has(trNum)) {
      issues.push({
        alt_olcut_id: altOlcutId,
        kod,
        olcut_adi: olcutAdi,
        sorun_tipi: 'parite_eksik_kanit',
        aciklama: `Türkçe raporda atıf alan [Kanıt ${trNum}] İngilizce metinde yer almamaktadır.`,
        eksik_kanitlar: [`[Evidence ${trNum}]`],
      });
    }
  });

  const missingEvidenceLabels: string[] = [];

  enFrequencies.forEach((_, evNum) => {
    // 1. Hedef kanıt nesnesini bul:
    const targetIdx = evNum - 1;
    const targetEv = 
      canonicalEvidenceList.find(e => Number(e.no) === evNum) ||
      (targetIdx >= 0 && targetIdx < canonicalEvidenceList.length ? canonicalEvidenceList[targetIdx] : null);

    if (!targetEv) {
      // Kanıt havuzunda bu numaraya karşılık gelen bir kayıt yok!
      missingEvidenceLabels.push(`[Evidence ${evNum}] (Havuzda ${evNum} numaralı kanıt tanımlı değil)`);
      return;
    }

    // 2. Tıklanabilir bağlantı doğrulaması
    const validLinkCount = anchorEvidenceCounts.get(evNum) || 0;

    if (validLinkCount === 0) {
      if (wrongTargetAnchorNums.has(evNum)) {
        // Numaralı bağlantı var ama hedefi targetEv ile eşleşmiyor
        missingEvidenceLabels.push(`[Evidence ${evNum}] (Bağlantı adresi hedef kanıt dosyasıyla eşleşmiyor)`);
      }
      // NOT: wrongTargetAnchorNums içinde yoksa, metinde sadece düz yazı atfı vardır.
      // Düz yazı atfı geçerli kanıt numarasına karşılık geliyorsa hata sayılmaz (toplamSorun artmaz).
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

export interface TekOdrDegerlendirmeSonucu {
  hasIssue: boolean;
  warningMessage: string | null;
  warningDetails: string[];
  issues: IngilizceOdrSorunu[];
  uncitedTrEvidences: Array<{ kanit_no?: number | string; dosya_adi: string; asama: string; url?: string }>;
}

/**
 * Tekil ÖDR kaydı kaydedildiğinde veya onaylanırken hem Türkçe metindeki kanıt atıflarını
 * hem de İngilizce ÖDR bütünlüğünü denetler.
 */
export function degerlendirTekOdr(params: {
  altOlcutId: number | string;
  kod: string;
  olcutAdi: string;
  icerikTr: string | null | undefined;
  icerikEn: string | null | undefined;
  kanitlar: any[] | null | undefined;
  pukoStages?: PukoKayit[] | null;
}): TekOdrDegerlendirmeSonucu {
  const htmlTr = params.icerikTr || '';
  const cleanNormalizedTr = normalizeHtmlForCitation(htmlTr);
  const pukoStages = Array.isArray(params.pukoStages) ? params.pukoStages : [];

  const orderMap: Record<string, number> = { planlama: 1, uygulama: 2, kontrol: 3, onlem: 4, iyilestirme: 4, olgunluk: 5 };
  const siraliPukoStages = [...pukoStages].sort(
    (a, b) => (orderMap[a.puko_asamasi?.toLowerCase()] || 99) - (orderMap[b.puko_asamasi?.toLowerCase()] || 99)
  );

  let localCounter = 1;
  const canonicalList: any[] = [];
  const pukoKanitKanonikMap = new Map<KanitDosyasi, number>();

  siraliPukoStages.forEach(p => {
    if (Array.isArray(p.kanit_dosyalari)) {
      p.kanit_dosyalari.forEach((k: any) => {
        if (!k) return;
        let ev = k.url ? canonicalList.find(e => Boolean(e.url) && e.url === k.url) : null;
        if (!ev) {
          ev = { ...k, no: localCounter++ };
          canonicalList.push(ev);
        }
        pukoKanitKanonikMap.set(k, ev.no);
      });
    }
  });

  const allStageEvidences: KanitDosyasi[] = [];
  siraliPukoStages.forEach(p => {
    if (Array.isArray(p.kanit_dosyalari)) {
      p.kanit_dosyalari.forEach(k => {
        if (k) allStageEvidences.push(k);
      });
    }
  });

  const uncitedTrEvidences: Array<{ kanit_no?: number | string; dosya_adi: string; asama: string; url?: string }> = [];

  // PUKÖ aşamalarındaki kanıtların Türkçe ÖDR metninde aktif bağlantı veya düz metin olarak atıf alıp almadığını kontrol et
  siraliPukoStages.forEach(p => {
    if (Array.isArray(p.kanit_dosyalari)) {
      p.kanit_dosyalari.forEach((k) => {
        if (!k) return;
        const kUrl = (k.url || k.dosya_url || k.storagePath || '').trim();
        const kName = (k.name || k.dosya_adi || '').trim();
        if (!kUrl && !kName) return;

        const evNum = pukoKanitKanonikMap.get(k) ?? k.no ?? k.evidence_no;

        const hasAnchorLink =
          isEvidenceLinkedInHtml(htmlTr, k) ||
          (Boolean(kName) &&
            allStageEvidences.some(
              otherK =>
                otherK !== k &&
                (otherK.name || otherK.dosya_adi || '').trim() === kName &&
                isEvidenceLinkedInHtml(htmlTr, otherK)
            ));

        const hasPlainTextCitation =
          Boolean(evNum && new RegExp(`\\bKan[ıi]t\\s*${evNum}\\b`, 'i').test(cleanNormalizedTr)) ||
          (Boolean(kName) && cleanNormalizedTr.toLowerCase().includes(kName.toLowerCase()));

        const inOdrHtml = hasAnchorLink || hasPlainTextCitation;

        if (!inOdrHtml) {
          const kRef = parseStorageReference(kUrl);
          const kBucket = (k.bucket || kRef?.bucket || 'dokumanlar').trim();
          const alreadyListed = uncitedTrEvidences.some(u =>
            (kUrl && u.url && urlsMatch(kUrl, u.url, kBucket)) ||
            (kName && u.dosya_adi === kName)
          );
          if (!alreadyListed) {
            uncitedTrEvidences.push({
              kanit_no: evNum,
              dosya_adi: kName || kUrl.split('/').pop() || 'Kanıt Dosyası',
              asama: p.puko_asamasi || 'PUKÖ',
              url: kUrl,
            });
          }
        }
      });
    }
  });

  const issues = denetleIngilizceOdr(params);

  const warningDetails: string[] = [];

  // 1. Türkçe ÖDR'de atıf almamış aşama kanıtlarının tamamı:
  if (uncitedTrEvidences.length > 0) {
    uncitedTrEvidences.forEach(u => {
      const label = u.kanit_no ? `[Kanıt ${u.kanit_no}]` : '[Kanıt]';
      warningDetails.push(`${label} ${u.dosya_adi} (${u.asama} aşaması) - Türkçe ÖDR metninde henüz atıf almamıştır.`);
    });
  }

  // 2. İngilizce ÖDR'deki tüm sorunların (issues) tamamı:
  if (issues.length > 0) {
    issues.forEach(issue => {
      warningDetails.push(issue.aciklama);
    });
  }

  const hasIssue = uncitedTrEvidences.length > 0 || issues.length > 0;

  if (!hasIssue) {
    return {
      hasIssue: false,
      warningMessage: null,
      warningDetails: [],
      issues: [],
      uncitedTrEvidences: [],
    };
  }

  return {
    hasIssue: true,
    warningMessage: warningDetails.join(' | '),
    warningDetails,
    issues,
    uncitedTrEvidences,
  };
}
