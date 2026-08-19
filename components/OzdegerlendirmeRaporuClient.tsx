'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Info, FileSignature, FileText, CheckCircle2, FileSearch, Download, Save, Plus, Link as LinkIcon } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor';
import { logAction } from '@/lib/logger';
import { validateFileSize, getAssignedLetter } from '@/lib/utils';

interface OzdegerlendirmeRaporuClientProps {
  params: Promise<{ id: string }>;
}

export default function OzdegerlendirmeRaporuClient({ params }: OzdegerlendirmeRaporuClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [raporOlusturuldu, setRaporOlusturuldu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [raporMetni, setRaporMetni] = useState('');
  const [raporMetniEn, setRaporMetniEn] = useState('');
  const [kanitlar, setKanitlar] = useState<any[]>([]);
  const [olgunlukPuani, setOlgunlukPuani] = useState<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Onay / Ret Sistematiği
  const [onayDurumu, setOnayDurumu] = useState<string>('');
  const [redNedeni, setRedNedeni] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Atıf (Kanıt) Yükleme Modalı
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [newEvidenceName, setNewEvidenceName] = useState('');
  const [isUploadingInText, setIsUploadingInText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = useTranslations('SelfEvaluation');
  const tPhase = useTranslations('Phase');
  const locale = useLocale();
  const router = useRouter();
  const { selectedPeriod } = usePeriod();
  const editorRef = useRef<RichTextEditorRef>(null);
  const editorEnRef = useRef<RichTextEditorRef>(null);

  const fetchData = useCallback(async () => {
    if (!selectedPeriod) return;
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      let localUserIsAdmin = false;
      if (user) {
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = profile?.rol?.toLowerCase() || '';
        localUserIsAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        const localUserIsObserver = role.includes('gözlemci') || role.includes('gozlemci');
        setIsAdmin(localUserIsAdmin);
        setIsObserver(localUserIsObserver);
        
        // Adminlerin de düzenleme yapabilmesi için ReadOnly kısıtlamasını esnetiyoruz, gözlemci ise kilitle
        if (selectedPeriod?.is_active === false || localUserIsObserver) {
          setIsReadOnly(true);
        }

        if (!localUserIsAdmin && !localUserIsObserver) {
          const { data: currentOlcut } = await supabase.from('alt_olcutler').select('kod').eq('id', resolvedParams.id).maybeSingle();
          const { count: assignmentCount } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('alt_olcut_id', resolvedParams.id);

          let isAuthorized = (assignmentCount || 0) > 0;

          if (!isAuthorized && currentOlcut?.kod) {
            const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id);
            const assignedLetter = getAssignedLetter(coordData?.[0]?.baslik);
            if (assignedLetter && currentOlcut.kod.startsWith(assignedLetter)) {
              isAuthorized = true;
            }
          }

          if (!isAuthorized) {
            router.replace('/olcutler');
            return;
          }
        }
      }

      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).maybeSingle();
      if (olcut) setOlcutDetay(olcut);
      
      const { data: raporData } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('*')
        .eq('alt_olcut_id', String(resolvedParams.id))
        .eq('donem_id', String(selectedPeriod?.id))
        .order('olusturulma_tarihi', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (raporData) {
        let cleanIcerik = raporData?.icerik ?? '';
        // Agresif temizlik
        cleanIcerik = cleanIcerik.replace(/<(h3|p|strong|b)[^>]*>\s*(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK)\s+AŞAMASI\s*<\/(h3|p|strong|b)>/gi, '');
        cleanIcerik = cleanIcerik.replace(/(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK)\s+AŞAMASI/gi, '');
        cleanIcerik = cleanIcerik.replace(/<hr\s*\/?>/gi, '');
        cleanIcerik = cleanIcerik.replace(/Olgunluk Düzeyi Puanı.*?\d\s*\/\s*\d/gi, '');

        let cleanIcerikEn = raporData?.icerik_en ?? '';
        cleanIcerikEn = cleanIcerikEn.replace(/<(h3|p|strong|b)[^>]*>\s*(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK)\s+AŞAMASI\s*<\/(h3|p|strong|b)>/gi, '');
        cleanIcerikEn = cleanIcerikEn.replace(/(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK)\s+AŞAMASI/gi, '');
        cleanIcerikEn = cleanIcerikEn.replace(/<hr\s*\/?>/gi, '');
        cleanIcerikEn = cleanIcerikEn.replace(/Olgunluk Düzeyi Puanı.*?\d\s*\/\s*\d/gi, '');

        setRaporMetni(cleanIcerik);
        setRaporMetniEn(cleanIcerikEn);
        setKanitlar(raporData?.kanitlar ?? []);
        setRaporOlusturuldu(true);
        setOnayDurumu(raporData?.onay_durumu || 'bekliyor');
        setRedNedeni(raporData?.red_nedeni);
      } else {
        setRaporMetni('');
        setRaporMetniEn('');
        setKanitlar([]);
        setRaporOlusturuldu(false);
        setOnayDurumu('bekliyor');
        setRedNedeni(null);
      }

      // --- ACL & AUTHORITY LOGIC ---
      const now = new Date();
      const { data: pukoData } = await supabase.from('puko_degerlendirmeleri').select('olgunluk_puani').eq('alt_olcut_id', resolvedParams.id).eq('donem_id', selectedPeriod.id);
      if (pukoData && pukoData.length > 0) {
        setOlgunlukPuani(pukoData[0].olgunluk_puani);
      }

      let accessLocked = false;
      
      // Eğer tarih kısıtı varsa ve kullanıcı admin/koordinatör değilse kontrol et
      if (olcut && !localUserIsAdmin) {
        if (olcut.erisim_baslangic && now < new Date(olcut.erisim_baslangic)) accessLocked = true;
        if (olcut.erisim_bitis && now > new Date(olcut.erisim_bitis)) accessLocked = true;
      }

      // Salt okunur olma durumlarını belirle
      let finalReadOnly = false;

      if (!localUserIsAdmin) {
        if (selectedPeriod?.is_active === false) finalReadOnly = true;
        if (accessLocked) finalReadOnly = true;
      } else {
        finalReadOnly = false;
      }

      setIsReadOnly(finalReadOnly);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedParams.id, selectedPeriod]);

  useEffect(() => {
    const syncInit = async () => {
      await fetchData();
    };
    syncInit();
  }, [fetchData]);

  const exportToWord = () => {
    if (isObserver) return;
    if (!raporMetni) return;

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${t('title')}</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; padding: 20px; }
        h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 10px; color: #1a202c; }
        h2 { color: #2d3748; margin-top: 20px; }
        h3 { background-color: #edf2f7; padding: 8px; border: 1px solid #cbd5e0; margin-top: 25px; color: #2b6cb0; text-transform: uppercase; font-size: 14px; }
        .kanit-section { margin-top: 40px; border-top: 2px solid #2b6cb0; padding-top: 10px; }
        .kanit-link { color: #3182ce; text-decoration: underline; font-weight: bold; }
        .footer { text-align: center; font-size: 11px; color: #718096; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
      </head>
      <body>
        <h1>${t('title')}</h1>
        <p style='text-align:center; font-weight: bold;'>${olcutDetay?.kod || ''} - ${getLocalizedField(olcutDetay, 'olcut_adi', locale) || ''}</p>
        <p style='text-align:center; color: #718096; font-size: 12px;'>Oluşturulma Tarihi: ${new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')} ${new Date().toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US')}</p>
        
        <div class='content'>
          ${raporMetni}
        </div>

        <div class='kanit-section'>
          <h2>${t('evidences')}</h2>
          ${kanitlar.length === 0 ? `<p><i>${t('no_evidence')}</i></p>` : '<ul>'}
          ${kanitlar.map((doc, idx) => `<li><strong id="kanit-${idx}">[Kanıt ${idx + 1}]</strong> <a class='kanit-link' href='${doc.url}'>${doc.name}</a></li>`).join('')}
          ${kanitlar.length === 0 ? '' : '</ul>'}
        </div>

        <div class='footer'>${t('title')} - Quality Management System</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('title').replace(/ /g, '_')}_${olcutDetay?.kod || 'Rapor'}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };


  const handleRaporOlustur = async () => {
    // GÜVENLİK KİLİDİ: Kullanıcı onayı olmadan mevcut veriyi ezme
    if ((raporMetni && raporMetni.trim() !== '' && raporMetni !== '<p></p>') || (raporMetniEn && raporMetniEn.trim() !== '' && raporMetniEn !== '<p></p>')) {
      const confirmReset = window.confirm("DİKKAT: Bu işlem editörde yaptığınız tüm manuel değişiklikleri (yazılar ve atıflar) SİLECEK ve metinleri önceki aşamalardaki ham verilerle baştan oluşturacaktır. Onaylıyor musunuz?");
      if (!confirmReset) return;
    }

    setIsGenerating(true);
    try {
      const adimlar = ['planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk'];
      const { data } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('donem_id', selectedPeriod?.id)
        .in('puko_asamasi', adimlar);

      if (!data || data.length === 0) {
        alert(t('no_data_alert'));
        setIsGenerating(false);
        return;
      }

      let birlesikMetin = '';
      let birlesikKanitlar: any[] = [];
      let puan = null;
      let localEvidenceCounter = 1;

      const orderMap: Record<string, number> = { planlama: 1, uygulama: 2, kontrol: 3, onlem: 4, olgunluk: 5 };
      const siraliData = [...data].sort((a, b) => (orderMap[a.puko_asamasi] || 99) - (orderMap[b.puko_asamasi] || 99));

      for (const row of siraliData) {
        let phaseText = row.aciklama;
        if (phaseText && phaseText.trim() !== '' && phaseText !== '<p></p>') {
          if (row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari) && row.kanit_dosyalari.length > 0) {
            const unplacedEvidenceStrings: string[] = [];
            row.kanit_dosyalari.forEach((k: any) => {
              let ev = birlesikKanitlar.find(e => e.url === k.url);
              if (!ev) {
                ev = { ...k, no: localEvidenceCounter++ };
                birlesikKanitlar.push(ev);
              }
              // Re-number inline evidence link text to match report-wide global ev.no using DOMParser
              if (typeof window !== 'undefined' && window.DOMParser) {
                try {
                  const parser = new DOMParser();
                  const docParsed = parser.parseFromString(phaseText, 'text/html');

                  let anchor: HTMLAnchorElement | null = null;

                  // 1. Primary: Find anchor by data-evidence-id
                  if (k.evidence_id) {
                    anchor = docParsed.querySelector(`a[data-evidence-id="${k.evidence_id}"]`);
                  }

                  // 2. Secondary: Match by normalized href
                  if (!anchor && k.url) {
                    const normalizeUrl = (u: string) => u.split('#')[0].split('?')[0];
                    const targetBaseUrl = normalizeUrl(k.url);
                    const targetAnnoBaseUrl = k.annotated_url ? normalizeUrl(k.annotated_url) : null;

                    const allAnchors = Array.from(docParsed.querySelectorAll('a'));
                    anchor = allAnchors.find(a => {
                      const href = a.getAttribute('href');
                      if (!href) return false;
                      const normHref = normalizeUrl(href);
                      return normHref === targetBaseUrl || (targetAnnoBaseUrl && normHref === targetAnnoBaseUrl);
                    }) || null;
                  }

                  if (anchor) {
                    if (k.evidence_id && !anchor.getAttribute('data-evidence-id')) {
                      anchor.setAttribute('data-evidence-id', k.evidence_id);
                    }
                    anchor.textContent = `[Kanıt ${ev.no}]`;
                  }

                  phaseText = docParsed.body.innerHTML;
                } catch (e) {
                  console.error('DOMParser ÖDR error:', e);
                }
              }

              const isAlreadyInline = (k.url && phaseText.includes(k.url)) || 
                                      (k.annotated_url && phaseText.includes(k.annotated_url)) ||
                                      (k.evidence_id && phaseText.includes(k.evidence_id));
              if (!isAlreadyInline) {
                unplacedEvidenceStrings.push(`<a href="${ev.url}" target="_blank" rel="noopener noreferrer" style="color: #ea580c; text-decoration: underline;">[Kanıt ${ev.no}]</a>`);
              }
            });
            
            if (unplacedEvidenceStrings.length > 0) {
              const evidenceHtml = ` <span style="font-weight: bold; font-size: 0.9em; margin-left: 6px;">${unplacedEvidenceStrings.join(' ')}</span>`;
              if (phaseText.trim().endsWith('</p>')) {
                phaseText = phaseText.trim().replace(/<\/p>$/, `${evidenceHtml}</p>`);
              } else {
                phaseText += evidenceHtml;
              }
            }
          }
          birlesikMetin += (birlesikMetin ? '<br/><br/>' : '') + phaseText;
        } else {
          if (row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari)) {
             row.kanit_dosyalari.forEach((k: any) => {
               if (!birlesikKanitlar.find(e => e.url === k.url)) {
                 birlesikKanitlar.push({ ...k, no: localEvidenceCounter++ });
               }
             });
          }
        }
        
        if (row.puko_asamasi === 'olgunluk' && row.olgunluk_puani) {
          puan = row.olgunluk_puani;
        }
      }

      if (puan) {
        setOlgunlukPuani(puan);
      }

      const uniqueKanitlar = birlesikKanitlar;

      setRaporMetni(birlesikMetin ?? '');
      setRaporMetniEn(birlesikMetin ?? '');
      setKanitlar(uniqueKanitlar ?? []);
      setRaporOlusturuldu(true);
      
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!selectedPeriod) throw new Error("Aktif dönem seçili değil.");
      
      const upsertData = {
        alt_olcut_id: String(resolvedParams.id),
        donem_id: String(selectedPeriod.id),
        icerik: raporMetni ?? '',
        icerik_en: raporMetniEn ?? '',
        kanitlar: kanitlar ?? [],
        onay_durumu: 'bekliyor',
        red_nedeni: null,
      };

      const { data: existingRecord } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('id')
        .eq('alt_olcut_id', String(resolvedParams.id))
        .eq('donem_id', String(selectedPeriod.id))
        .order('olusturulma_tarihi', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRecord?.id) {
        const { error: err } = await supabase.from('ozdegerlendirme_raporlari').update(upsertData).eq('id', existingRecord.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('ozdegerlendirme_raporlari').insert(upsertData);
        if (err) throw err;
      }

      // Rapor her kaydedildiğinde durumu 'bekliyor'a çek (Onaylanmış olsa bile tekrar onaya düşer)
      const { data: currentRecord } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('id')
        .eq('alt_olcut_id', String(resolvedParams.id))
        .eq('donem_id', String(selectedPeriod.id))
        .maybeSingle();

      if (currentRecord) {
        const { error: rErr } = await supabase
          .from('ozdegerlendirme_raporlari')
          .update({ onay_durumu: 'bekliyor', red_nedeni: null })
          .eq('id', currentRecord.id);
        if (rErr) throw rErr;

        await logAction({
          supabase,
          islemTipi: 'UPDATE',
          tabloAdi: 'ozdegerlendirme_raporlari',
          kayitId: currentRecord.id,
          yeniVeri: { ...upsertData, onay_durumu: 'bekliyor' }
        });

        if (!isAdmin) {
          // BİLDİRİM SENKRONİZASYONU: Kullanıcı raporu güncellediğinde, puko durumlarını 'Beklemede'ye çek.
          const { error: pErr } = await supabase
            .from('puko_degerlendirmeleri')
            .update({ durum: 'Beklemede', red_nedeni: null })
            .eq('alt_olcut_id', String(resolvedParams.id))
            .eq('donem_id', String(selectedPeriod.id));
          if (pErr) throw pErr;
        }

        setOnayDurumu('bekliyor');
        setRedNedeni(null);
      }

      alert(t('save_success'));
      // fetchData() ÇAĞIRILMAYACAK - State koruması için sadece sessizce kaydetiyoruz
    } catch (err: any) {
      console.error(err);
      alert(`${t('error_prefix')}${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    setIsActionSubmitting(true);
    try {
      // ozdegerlendirme_raporlari tablosunu güncelle
      const { data: currentRecord } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('donem_id', selectedPeriod?.id)
        .maybeSingle();

      if (currentRecord) {
        const { error } = await supabase
          .from('ozdegerlendirme_raporlari')
          .update({ onay_durumu: 'onaylandi', red_nedeni: null })
          .eq('id', currentRecord.id);
        if (error) throw error;
        
        // BİLDİRİM SENKRONİZASYONU: PUKÖ tablosundaki o alt ölçüte ait tüm kayıtları 'Onaylandı' yap
        await supabase
          .from('puko_degerlendirmeleri')
          .update({ durum: 'Onaylandı', red_nedeni: null })
          .eq('alt_olcut_id', resolvedParams.id)
          .eq('donem_id', selectedPeriod?.id);

        // Bildirim Ekleme İşlemi
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const targetUserId = currentRecord.olusturan_id || currentRecord.kullanici_id || currentRecord.user_id || null;
        
        if (currentUser) {
          try {
            await supabase.from('bildirimler').insert({
              gonderen_id: currentUser.id,
              alici_id: targetUserId,
              mesaj: `Özdeğerlendirme Raporunuz ONAYLANDI.`,
              tip: 'onay',
              ilgili_kayit_id: resolvedParams.id
            });
          } catch (e) {
            console.warn("Bildirim tablosu henüz oluşturulmamış olabilir.", e);
          }
        }

        setOnayDurumu('onaylandi');
      }
      alert(t('approve_success'));
    } catch (err: any) {
      alert(`${t('error_approve')}${err.message}`);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      alert(t('enter_reject_reason'));
      return;
    }
    setIsActionSubmitting(true);
    try {
      const { data: currentRecord } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('donem_id', selectedPeriod?.id)
        .maybeSingle();

      if (currentRecord) {
        const { error } = await supabase
          .from('ozdegerlendirme_raporlari')
          .update({ onay_durumu: 'reddedildi', red_nedeni: rejectReason })
          .eq('id', currentRecord.id);
        if (error) throw error;

        // BİLDİRİM SENKRONİZASYONU: PUKÖ tablosundaki o alt ölçüte ait tüm kayıtları 'Reddedildi' yap
        await supabase
          .from('puko_degerlendirmeleri')
          .update({ durum: 'Reddedildi', red_nedeni: rejectReason })
          .eq('alt_olcut_id', resolvedParams.id)
          .eq('donem_id', selectedPeriod?.id);

        // Bildirim Ekleme İşlemi
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const targetUserId = currentRecord.olusturan_id || currentRecord.kullanici_id || currentRecord.user_id || null;
        
        if (currentUser) {
          try {
            await supabase.from('bildirimler').insert({
              gonderen_id: currentUser.id,
              alici_id: targetUserId,
              mesaj: `Özdeğerlendirme Raporunuz REDDEDİLDİ. Neden: ${rejectReason.trim()}`,
              tip: 'red',
              ilgili_kayit_id: resolvedParams.id
            });
          } catch (e) {
            console.warn("Bildirim tablosu henüz oluşturulmamış olabilir.", e);
          }
        }

        setOnayDurumu('reddedildi');
        setRedNedeni(rejectReason);
      }
      setIsRejectModalOpen(false);
      setRejectReason('');
      alert(t('reject_success'));
    } catch (err: any) {
      alert(`${t('error_reject')}${err.message}`);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleKanitEkle = (index: number, target: 'tr' | 'en' = 'tr') => {
    if (isReadOnly) return;
    const doc = kanitlar[index];
    if (!doc) return;

    // KESİNLİKLE [Kanıt X] formatında, yeni sekmede açılacak link
    const anchorHTML = `&nbsp;<a href="${doc.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: bold; text-decoration: underline; cursor: pointer;">[Kanıt ${index + 1}]</a>&nbsp;`;
    
    if (target === 'tr') {
      if (editorRef.current) {
        editorRef.current.insertContent(anchorHTML);
      } else {
        setRaporMetni(prev => (prev || '') + anchorHTML);
      }
    } else {
      if (editorEnRef.current) {
        editorEnRef.current.insertContent(anchorHTML);
      } else {
        setRaporMetniEn(prev => (prev || '') + anchorHTML);
      }
    }
  };

  const handleFileUploadForInText = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !newEvidenceName.trim()) return;
    
    const file = event.target.files[0];
    
    const validation = validateFileSize(file);
    if (!validation.valid) {
      alert(validation.error);
      event.target.value = '';
      return;
    }

    setIsUploadingInText(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${resolvedParams.id}_evidence_${Math.random()}.${fileExt}`;
      const filePath = `ozdegerlendirme/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const yeniKanit = { 
        name: newEvidenceName, 
        url: publicUrl, 
        size: Math.round(file.size / 1024), 
        manual: true 
      };

      const updatedKanitlar = [...kanitlar, yeniKanit];
      setKanitlar(updatedKanitlar);
      
      // Metin içine ekle - [Kanıt X] formatında
      const newIndex = updatedKanitlar.length;
      const anchorHTML = `&nbsp;<a href="${publicUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: bold; text-decoration: underline; cursor: pointer;">[Kanıt ${newIndex}]</a>&nbsp;`;
      
      if (editorRef.current) {
        editorRef.current.insertContent(anchorHTML);
      } else {
        setRaporMetni(prev => (prev || '') + anchorHTML);
      }

      setIsEvidenceModalOpen(false);
      setNewEvidenceName('');
      alert("Kanıt başarıyla yüklendi ve metne eklendi.");
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Yükleme hatası: ${error.message}`);
    } finally {
      setIsUploadingInText(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleYeniKanitTanımla = () => {
    if (isReadOnly) return;
    setIsEvidenceModalOpen(true);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-700 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">{t('home')}</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">{t('criteria')}</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
            </h2>
            <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
          </div>
          <p className="text-sm text-slate-800">{t('synthesis_desc')}</p>
        </div>

        {/* ACL Uyarı Bannerı */}
        {isReadOnly && !isAdmin && olcutDetay && (olcutDetay.erisim_baslangic || olcutDetay.erisim_bitis) && (
          <div className="flex-1 max-w-2xl mx-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 animate-pulse">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-bold leading-relaxed">
              DİKKAT: Bu ölçüt için veri giriş süresi kısıtlanmıştır. 
              {olcutDetay.erisim_baslangic && ` Başlangıç: ${new Date(olcutDetay.erisim_baslangic).toLocaleString()}`}
              {olcutDetay.erisim_bitis && ` Bitiş: ${new Date(olcutDetay.erisim_bitis).toLocaleString()}`}
            </p>
          </div>
        )}

        {/* Onay/Red Durumu Göstergesi */}
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          {onayDurumu && (
            <div className={`flex flex-col items-end gap-1`}>
              <div className={`px-4 py-1.5 rounded-lg text-sm font-bold border uppercase tracking-wider ${
                onayDurumu === 'onaylandi' ? 'bg-green-50 text-green-700 border-green-200' : 
                onayDurumu === 'reddedildi' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {
                  onayDurumu === 'onaylandi' ? tPhase('status_approved') : 
                  onayDurumu === 'reddedildi' ? tPhase('status_rejected') : 
                  tPhase('status_pending')
                }
              </div>
              {onayDurumu === 'reddedildi' && redNedeni && (
                <div className="text-[11px] text-red-600 font-medium max-w-xs text-right">
                  Neden: {redNedeni}
                </div>
              )}
            </div>
          )}
          
          {isAdmin && (
            <>
              <button 
                onClick={handleApprove}
                disabled={isActionSubmitting || onayDurumu === 'onaylandi'}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                {t('approve_criterion')}
              </button>
              <button 
                onClick={() => setIsRejectModalOpen(true)}
                disabled={isActionSubmitting || onayDurumu === 'reddedildi'}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                {t('reject_criterion')}
              </button>
            </>
          )}
        </div>
      </div>

      <StepPanel activeStepId="rapor" altOlcutId={resolvedParams.id} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden mb-6 relative min-h-[400px]">
        {!raporOlusturuldu && !isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-blue-50/50 to-white">
            <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <FileSignature className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">{t('title')}</h3>
            <p className="text-slate-500 max-w-lg mb-8 leading-relaxed">
              {t('merge_data_description') || 'Özdeğerlendirme Raporunuzu oluşturmak için verileri birleştirin.'}
            </p>
            <button 
              onClick={handleRaporOlustur}
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 font-bold text-white transition-all duration-300 bg-blue-600 rounded-full hover:bg-blue-700 hover:scale-105 hover:shadow-[0_0_40px_rgba(37,99,235,0.4)] focus:outline-none overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <FileSearch className="w-6 h-6 relative z-10" />
              <span className="text-lg relative z-10">{t('pull_and_edit')}</span>
            </button>
          </div>
        ) : isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-white">
             <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-6" />
             <h3 className="text-xl font-bold text-slate-700 mb-2">Veriler Birleştiriliyor...</h3>
             <p className="text-slate-500">Önceki aşamalardaki bilgiler toparlanıyor.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="bg-blue-600 p-6 flex items-center justify-between text-white flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-blue-200" />
                <div>
                  <h3 className="text-xl font-bold">{t('editor_title')}</h3>
                  <p className="text-blue-100 text-sm">{t('editor_desc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!isObserver && (
                  <button 
                    onClick={exportToWord}
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> {t('download_word')}
                  </button>
                )}
                <button 
                  onClick={handleRaporOlustur}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <FileSearch className="w-4 h-4" /> {t('re_pull')}
                </button>
                {!isReadOnly && (
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-emerald-500 hover:bg-emerald-600 px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-70"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? t('saving_report') : t('save_report')}
                  </button>
                )}
              </div>
            </div>

            <div className="p-8 lg:p-12 bg-[#FAFAFA] border-b border-slate-200 space-y-8">
              <div>
                <h4 className="text-base font-bold text-slate-800 mb-2">Türkçe Rapor Metni</h4>
                <RichTextEditor ref={editorRef} content={raporMetni} onChange={setRaporMetni} readOnly={isReadOnly} minHeight="400px" />
              </div>
              
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
                  {t('english_report_title')}
                  <span className="text-xs font-normal text-slate-500">({t('english_report_desc')})</span>
                </h4>
                <RichTextEditor ref={editorEnRef} content={raporMetniEn} onChange={setRaporMetniEn} readOnly={isReadOnly} minHeight="400px" />
              </div>
            </div>

            <div className="p-8 lg:p-12 bg-white">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  {t('evidence_list_title')}
                </div>
                {!isReadOnly && (
                  <button 
                    onClick={handleYeniKanitTanımla}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> {t('add_new_evidence')}
                  </button>
                )}
              </h3>
              
              {kanitlar.length === 0 ? (
                <div className="text-slate-500 italic p-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-center">
                  {t('no_evidence_uploaded')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-3 px-4 w-24">{t('evidence_no')}</th>
                        <th className="py-3 px-4">{t('evidence_name')}</th>
                        <th className="py-3 px-4 w-32 text-center">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kanitlar.map((doc, idx) => (
                        <tr key={idx} id={`kanit-${idx}`} className="hover:bg-slate-50 transition-colors group">
                          <td className="py-3 px-4 font-bold text-blue-600">
                            Kanıt {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:text-blue-600 font-medium flex items-center gap-2">
                              <LinkIcon className="w-4 h-4 text-slate-400" />
                              : ({doc.name})
                            </a>
                            {doc.size && <span className="text-xs text-slate-400 block mt-1">{doc.size} KB</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {!isReadOnly && (
                              <div className="flex gap-2 justify-center">
                                <button 
                                  onClick={() => handleKanitEkle(idx, 'tr')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" /> TR
                                </button>
                                <button 
                                  onClick={() => handleKanitEkle(idx, 'en')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" /> EN
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                {t('reject_modal_title')}
              </h3>
              <button 
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isActionSubmitting}
              >
                {t('close')}
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                {t('reject_desc')}
              </p>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('reject_reason')} (<span className="text-red-500">*</span>)</label>
                <textarea 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('reject_placeholder')}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isActionSubmitting}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleRejectSubmit}
                disabled={isActionSubmitting || !rejectReason.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isActionSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('confirm_reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Atıf (Kanıt) Yükleme Modalı */}
      {isEvidenceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-6 h-6 text-blue-600" />
                Metin İçi Atıf / Kanıt Ekle
              </h3>
              <button onClick={() => setIsEvidenceModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <LinkIcon className="w-5 h-5 text-slate-400 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Kanıt Adı</label>
                <input 
                  type="text"
                  value={newEvidenceName}
                  onChange={(e) => setNewEvidenceName(e.target.value)}
                  placeholder="Örn: 2023 Yılı Memnuniyet Anketi"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Dosya Yükle (PDF/Word)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="p-4 bg-slate-100 rounded-2xl group-hover:bg-blue-100 transition-colors">
                    <Plus className="w-8 h-8 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-500 group-hover:text-blue-700">Dosya seçmek için tıklayın</span>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUploadForInText}
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                  />
                </div>
              </div>

              {isUploadingInText && (
                <div className="flex items-center justify-center gap-3 text-blue-600 font-bold py-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Dosya Yükleniyor ve Atıf Oluşturuluyor...
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsEvidenceModalOpen(false)}
                className="px-6 py-3 text-slate-600 font-bold hover:text-slate-800 transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
