'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, LineChart, FileText, Printer, Building2, CheckCircle2, Download, BookOpen } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import DOMPurify from 'dompurify';
import { usePeriod } from '@/contexts/PeriodContext';

interface AnaBaslik {
  id: string;
  kod: string;
  baslik_adi: string;
}

interface AltOlcut {
  id: string;
  kod: string;
  olcut_adi: string;
  ana_baslik_id: string;
}

interface PukoVerisi {
  alt_olcut_id: string;
  puko_asamasi: string;
  aciklama: string;
  olgunluk_puani: number | null;
  kanit_dosyalari: any[];
}

export default function RaporlarClient() {
  const t = useTranslations('Reports');
  const { selectedPeriod } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [raporData, setRaporData] = useState<{
    anaBasliklar: AnaBaslik[],
    altOlcutler: AltOlcut[],
    pukoVerileri: PukoVerisi[],
    ozdegerlendirmeVerileri: any[]
  } | null>(null);
  const locale = useLocale();

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
          const role = profile?.rol?.toLowerCase() || '';
          const userIsAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
          const userIsObserver = role.includes('gozlemci') || role.includes('gözlemci');
          if (userIsAdmin || userIsObserver) {
            setIsAdmin(true);
          }
          setIsObserver(userIsObserver);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Periyot değişiminde state temizleme
  useEffect(() => {
    setRaporData(null);
  }, [selectedPeriod]);

  const getDuzeyAciklamasi = (olcut: any, puan: number, loc: string) => {
    if (!olcut || !puan) return '';
    if (loc !== 'tr' && olcut[`olgunluk_duzeyleri_${loc}`]) {
      const localeObj = olcut[`olgunluk_duzeyleri_${loc}`];
      if (localeObj && typeof localeObj === 'object' && localeObj[puan.toString()]) {
        return localeObj[puan.toString()];
      }
    }
    const defaultObj = olcut['olgunluk_duzeyleri'];
    if (defaultObj && typeof defaultObj === 'object' && defaultObj[puan.toString()]) {
       return defaultObj[puan.toString()];
    }
    return '';
  };

  const handleKurumRaporuOlustur = async () => {
    setIsGenerating(true);
    try {
      const { data: anaBasliklar } = await supabase.from('ana_basliklar').select('*').order('kod', { ascending: true });
      const { data: altOlcutler } = await supabase.from('alt_olcutler').select('*').order('kod', { ascending: true });
      const { data: pukoVerileri } = await supabase.from('puko_degerlendirmeleri')
        .select('alt_olcut_id, puko_asamasi, aciklama, olgunluk_puani, kanit_dosyalari')
        .eq('donem_id', String(selectedPeriod?.id))
        .eq('durum', 'Onaylandı');
      const { data: ozdegerlendirmeVerileri } = await supabase.from('ozdegerlendirme_raporlari')
        .select('alt_olcut_id, icerik, icerik_en, kanitlar, olusturulma_tarihi')
        .eq('donem_id', String(selectedPeriod?.id))
        .eq('onay_durumu', 'onaylandi')
        .order('olusturulma_tarihi', { ascending: false });



      const sortedAnaBasliklar = [...(anaBasliklar || [])].sort((a, b) => a.kod.localeCompare(b.kod, undefined, { numeric: true, sensitivity: 'base' }));
      const sortedAltOlcutler = [...(altOlcutler || [])].sort((a, b) => a.kod.localeCompare(b.kod, undefined, { numeric: true, sensitivity: 'base' }));

      setRaporData({
        anaBasliklar: sortedAnaBasliklar,
        altOlcutler: sortedAltOlcutler,
        pukoVerileri: pukoVerileri || [],
        ozdegerlendirmeVerileri: ozdegerlendirmeVerileri || []
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKaliteRaporuOlustur = async () => {
    setIsGenerating(true);
    try {
      const { data: altOlcutler } = await supabase
        .from('alt_olcutler')
        .select('*')
        .not('kalite_el_kitabi', 'is', null)
        .order('kod', { ascending: true });

      if (!altOlcutler || altOlcutler.length === 0) {
        alert("Henüz Kalite El Kitabı verisi girilmiş ölçüt bulunamadı.");
        return;
      }

      let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Kurumsal Kalite El Kitabı</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; padding: 20px; }
          h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid #2563eb; padding-bottom: 10px; color: #1e40af; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; page-break-inside: avoid; }
          th { background-color: #2563eb; color: white; padding: 12px; text-align: left; font-size: 16px; border: 1px solid #1e40af; }
          td.label { background-color: #2563eb; color: white; width: 30%; padding: 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 12px; }
          td.data { background-color: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; }
          .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 50px; }
        </style>
        </head>
        <body>
          <h1>KURUMSAL KALİTE EL KİTABI</h1>
          <p style='text-align:center; color: #64748b; margin-bottom: 30px;'>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
      `;

      altOlcutler.forEach((olcut, index) => {
        const data = olcut.kalite_el_kitabi;
        if (!data) return;

        htmlContent += `
          <table>
            <thead>
              <tr>
                <th colspan="2">Tablo ${index + 1}. ${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', 'tr')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="label">Sorumlu Birim</td><td class="data">${data.sorumlu_birim || '-'}</td></tr>
              <tr><td class="label">İlk Planlama Tarihi</td><td class="data">${data.ilk_planlama_tarihi || '-'}</td></tr>
              <tr><td class="label">İç Paydaşlar</td><td class="data">${data.ic_paydaslar || '-'}</td></tr>
              <tr><td class="label">Dış Paydaşlar</td><td class="data">${data.dis_paydaslar || '-'}</td></tr>
              <tr><td class="label">Uluslararası Paydaşlar</td><td class="data">${data.uluslararasi_paydaslar || '-'}</td></tr>
              <tr><td class="label">Uygulama Alanları</td><td class="data">${data.uygulama_alanlari || '-'}</td></tr>
              <tr><td class="label">İzleme Mekanizmaları</td><td class="data">${data.izleme_mekanizmalari || '-'}</td></tr>
              <tr><td class="label">Performans Göstergeleri</td><td class="data">${data.performans_gostergeleri || '-'}</td></tr>
              <tr><td class="label">Değerlendirme ve İyileştirme Tarihi</td><td class="data">${data.degerlendirme_iyilestirme_tarihi || '-'}</td></tr>
              <tr><td class="label">Alt Ölçütün Bilgi Yönetim Sistemindeki Yeri</td><td class="data">${data.bgs_yeri || '-'}</td></tr>
            </tbody>
          </table>
        `;
      });

      htmlContent += `
          <div class='footer'>Akreditasyon Bilgi Yönetim Sistemi tarafından otomatik oluşturulmuştur.</div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Kurumsal_Kalite_El_Kitabi.doc';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Rapor oluşturma hatası: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="h-[calc(100vh-100px)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-8">
        <div className="bg-red-50 p-10 rounded-3xl border border-red-200 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-700 mb-2">{t('unauthorized_access')}</h2>
          <p className="text-red-500">{t('unauthorized_desc')}</p>
        </div>
      </div>
    );
  }



  const exportToWord = (isEn = false) => {
    if (isObserver) return;
    if (!raporData) return;

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${isEn ? 'Institutional Self-Evaluation Report (English)' : t('institutional_report')}</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; padding: 20px; }
        h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 10px; color: #1a202c; }
        h2 { background-color: #edf2f7; padding: 10px; border: 1px solid #cbd5e0; margin-top: 30px; color: #2d3748; }
        h3 { color: #2b6cb0; border-bottom: 1px solid #e2e8f0; margin-top: 20px; padding-bottom: 5px; }
        .olgunluk { background-color: #fffaf0; padding: 10px; border: 1px solid #feebc8; font-weight: bold; margin-top: 10px; color: #c05621; }
        .footer { text-align: center; font-size: 11px; color: #718096; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        ul { margin-top: 5px; }
        li { font-size: 13px; color: #4a5568; }
      </style>
      </head>
      <body>
        <h1>${isEn ? 'Institutional Self-Evaluation Report (English)' : t('institutional_report')}</h1>
        <p style='text-align:center; color: #718096;'>${isEn ? 'Creation Date' : t('created_at')}: ${new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')} ${new Date().toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US')}</p>
    `;

    raporData.anaBasliklar.forEach(anaBaslik => {
      const ilgiliOlcutler = raporData.altOlcutler.filter(o => o.ana_baslik_id === anaBaslik.id);
      if (ilgiliOlcutler.length > 0) {
        const docLang = isEn ? 'en' : locale;
        htmlContent += `<h2>${anaBaslik.kod} - ${getLocalizedField(anaBaslik, 'baslik_adi', docLang)}</h2>`;
        ilgiliOlcutler.forEach(olcut => {
          const ozdegerlendirme = raporData.ozdegerlendirmeVerileri.find(ov => String(ov.alt_olcut_id) === String(olcut.id));
          const pukoList = getPukoForOlcut(olcut.id);
          
          let combinedText = '';
          const allEvidences: any[] = [];
          let localEvidenceCounter = 1;

          const targetIcerik = isEn ? ozdegerlendirme?.icerik_en : ozdegerlendirme?.icerik;

          if (ozdegerlendirme && targetIcerik) {
            combinedText = targetIcerik;
            
            // Agresif temizlik: Başlıkları ve puan metinlerini her türlü tag yapısında temizle
            combinedText = combinedText.replace(/<(h3|p|strong|b)[^>]*>\s*(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK|RAPOR)\s+AŞAMASI\s*<\/(h3|p|strong|b)>/gi, '');
            combinedText = combinedText.replace(/(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK|RAPOR)\s+AŞAMASI/gi, '');
            combinedText = combinedText.replace(/<hr\s*\/?>/gi, '');
            combinedText = combinedText.replace(/Olgunluk Düzeyi Puanı.*?\d\s*\/\s*\d/gi, '');
            combinedText = combinedText.replace(/<p style="color: #718096; font-style: italic; margin-top: 5px; font-size: 13px;">.*?<\/p>/gi, '');
            
            (ozdegerlendirme.kanitlar || []).forEach((k: any) => {
              let ev = allEvidences.find(e => e.url === k.url);
              if (!ev) {
                ev = { ...k, no: localEvidenceCounter++ };
                allEvidences.push(ev);
              }
            });
          } else {
            combinedText = '';
          }

          const uniqueEvidences = allEvidences;
          const olgunlukPuani = pukoList.find(p => p.puko_asamasi === 'olgunluk')?.olgunluk_puani;

          htmlContent += `<h3>${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', docLang)}</h3>`;
          
          if (combinedText) {
            htmlContent += `<div>${combinedText}</div>`;
          } else {
            htmlContent += `<p style='color: #a0aec0; font-style: italic;'>${isEn ? 'No English report available for this criterion.' : t('no_report_yet')}</p>`;
          }
          
          if (combinedText || olgunlukPuani || uniqueEvidences.length > 0) {
            htmlContent += `<div style='background-color: #fffaf0; padding: 15px; border: 1px solid #feebc8; margin-top: 20px;'>`;
            
            if (olgunlukPuani) {
              const rubricText = getDuzeyAciklamasi(olcut, olgunlukPuani, docLang);
              htmlContent += `<p style='color: #c05621; font-weight: bold; margin: 0;'>${isEn ? 'Maturity Score' : t('maturity_score')}: ${olgunlukPuani} / 5</p>`;
              if (rubricText) {
                htmlContent += `<p style='color: #9c4221; font-style: italic; font-size: 13px; margin-top: 5px; margin-bottom: 15px;'>${rubricText}</p>`;
              }
            }
            
            if (uniqueEvidences.length > 0) {
              htmlContent += `<div style='border-top: 1px solid #feebc8; padding-top: 10px; margin-top: 10px;'>`;
              htmlContent += `<p style='color: #c05621; font-size: 12px; font-weight: bold; margin-bottom: 5px;'>${isEn ? 'Attached Evidences' : t('attached_evidences')}</p>`;
              const evidenceLinks = uniqueEvidences.map((k, idx) => 
                `<a href='${k.url}' style='color: #2b6cb0; text-decoration: none; font-size: 12px; display: block; margin-bottom: 3px;'>${k.no}. ${k.name}</a>`
              ).join('');
              htmlContent += evidenceLinks;
              htmlContent += `</div>`;
            }
            
            htmlContent += `</div>`;
          }
        });
      }
    });

    htmlContent += `
        <div class='footer'>${isEn ? 'This document was automatically generated by the quality management system.' : t('auto_generated_footer')}</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isEn ? 'Institutional_Self_Evaluation_Report_EN.doc' : 'Kurum_Raporu.doc';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPukoForOlcut = (olcutId: string) => {
    return raporData?.pukoVerileri.filter(p => p.alt_olcut_id === olcutId) || [];
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      
      <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <LineChart className="w-8 h-8 text-blue-600" />
            {t('title')}
          </h1>
          <p className="text-slate-500 mt-2">{t('description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {raporData && !isObserver && (
            <>
              <button 
                onClick={() => exportToWord(false)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-5 h-5" /> {t('export_word')}
              </button>
              <button 
                onClick={() => exportToWord(true)}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-5 h-5" /> {t('export_word_en')}
              </button>
            </>
          )}
        </div>
      </div>

      {!raporData && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative min-h-[400px]">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-12 text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-6" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">{t('generating_title')}</h3>
              <p className="text-slate-500">{t('generating_desc')}</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-indigo-50/50 to-white">
              <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Building2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3">{t('institutional_report')}</h3>
              <p className="text-slate-500 max-w-lg mb-8 leading-relaxed">
                {t('report_summary')}
              </p>
              <button 
                onClick={handleKurumRaporuOlustur}
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 font-bold text-white transition-all duration-300 bg-indigo-600 rounded-full hover:bg-indigo-700 hover:scale-105 hover:shadow-xl focus:outline-none overflow-hidden"
              >
                <FileText className="w-6 h-6 relative z-10" />
                <span className="text-lg relative z-10">{t('create_report')}</span>
              </button>

            </div>
          )}
        </div>
      )}

      {/* Rapor İçeriği (Önizleme) */}
      {raporData && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10">
          
          <div className="text-center mb-12 border-b-2 border-slate-800 pb-8">
            <h1 className="text-4xl font-black text-slate-900 mb-4 uppercase">{t('institutional_report')}</h1>
            <p className="text-lg text-slate-600">{t('created_at')}: {new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')} {new Date().toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US')}</p>
          </div>

          <div className="space-y-16">
            {(() => {
              return raporData.anaBasliklar.map((anaBaslik) => {
                const ilgiliOlcutler = raporData.altOlcutler.filter(o => o.ana_baslik_id === anaBaslik.id);
                
                if (ilgiliOlcutler.length === 0) return null;

                return (
                  <div key={anaBaslik.id}>
                    <div className="bg-slate-800 text-white p-4 rounded-lg mb-6">
                      <h2 className="text-2xl font-bold">{anaBaslik.kod} - {getLocalizedField(anaBaslik, 'baslik_adi', locale)}</h2>
                    </div>

                    <div className="space-y-12 pl-4 border-l-4 border-slate-200 ml-4">
                      {ilgiliOlcutler.map((olcut) => {
                        const ozdegerlendirme = raporData.ozdegerlendirmeVerileri.find(ov => String(ov.alt_olcut_id) === String(olcut.id));
                        const pukoList = getPukoForOlcut(olcut.id);
                        
                        let combinedText = '';
                        const allEvidences: any[] = [];
                        let localEvidenceCounter = 1;

                        if (ozdegerlendirme && ozdegerlendirme.icerik) {
                          combinedText = ozdegerlendirme.icerik;
                          
                          // Agresif temizlik: Başlıkları ve puan metinlerini her türlü tag yapısında temizle
                          combinedText = combinedText.replace(/<(h3|p|strong|b)[^>]*>\s*(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK|RAPOR)\s+AŞAMASI\s*<\/(h3|p|strong|b)>/gi, '');
                          combinedText = combinedText.replace(/(PLANLAMA|UYGULAMA|KONTROL|ÖNLEM|ONLEM|OLGUNLUK|RAPOR)\s+AŞAMASI/gi, '');
                          combinedText = combinedText.replace(/<hr\s*\/?>/gi, '');
                          combinedText = combinedText.replace(/Olgunluk Düzeyi Puanı.*?\d\s*\/\s*\d/gi, '');
                          combinedText = combinedText.replace(/<p style="color: #718096; font-style: italic; margin-top: 5px; font-size: 13px;">.*?<\/p>/gi, '');
                          
                          (ozdegerlendirme.kanitlar || []).forEach((k: any) => {
                            let ev = allEvidences.find(e => e.url === k.url);
                            if (!ev) {
                              ev = { ...k, no: localEvidenceCounter++ };
                              allEvidences.push(ev);
                            }
                          });
                        } else {
                          combinedText = '';
                        }

                        const evidencesWithNumbers = allEvidences;
                        const olgunlukPuani = pukoList.find(p => p.puko_asamasi === 'olgunluk')?.olgunluk_puani;

                        return (
                          <div key={olcut.id} className="mb-12">
                            <h3 className="text-xl font-bold text-blue-800 mb-6 flex items-center gap-2">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{olcut.kod}</span>
                              {getLocalizedField(olcut, 'olcut_adi', locale)}
                            </h3>
                            
                            {combinedText ? (
                              <div className="space-y-6">
                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                  <div 
                                    className="prose prose-sm max-w-none prose-slate"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(combinedText) }}
                                  />
                                </div>
                                
                                <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl space-y-4">
                                  {olgunlukPuani ? (
                                    <>
                                      <div className="flex items-center justify-between border-b border-orange-200/50 pb-4">
                                        <span className="font-bold text-orange-800">{t('maturity_score')}:</span>
                                        <span className="text-xl font-black text-orange-600">{olgunlukPuani} / 5</span>
                                      </div>
                                      <p className="text-sm text-orange-800 italic leading-relaxed">
                                        {getDuzeyAciklamasi(olcut, olgunlukPuani, locale)}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-sm text-slate-500 italic">{t('maturity_score_missing')}</p>
                                  )}
                                  
                                  {evidencesWithNumbers.length > 0 && (
                                    <div className="pt-4 border-t border-orange-200/50 flex flex-col gap-3">
                                      <span className="text-xs font-bold text-orange-700 uppercase">{t('attached_evidences')}</span>
                                      <div className="flex flex-col gap-2">
                                        {evidencesWithNumbers.map((k) => (
                                          <a 
                                            key={k.url}
                                            href={k.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                          >
                                            {k.no}. {k.name}
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 border-dashed text-center">
                              <p className="text-slate-400 italic text-sm">{t('no_report_yet')}</p>
                              <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl space-y-4 mt-6 text-left">
                                {olgunlukPuani && (
                                  <>
                                    <div className="flex items-center justify-between border-b border-orange-200/50 pb-4">
                                      <span className="font-bold text-orange-800 uppercase text-xs">{t('maturity_score')}:</span>
                                      <span className="text-lg font-bold text-orange-600">{olgunlukPuani} / 5</span>
                                    </div>
                                    <p className="text-sm text-orange-800 italic leading-relaxed">
                                      {getDuzeyAciklamasi(olcut, olgunlukPuani, locale)}
                                    </p>
                                  </>
                                )}
                                {evidencesWithNumbers.length > 0 && (
                                  <div className="pt-4 border-t border-orange-200/50 flex flex-col gap-3">
                                    <span className="text-xs font-bold text-orange-700 uppercase">{t('attached_evidences')}</span>
                                    <div className="flex flex-col gap-2">
                                      {evidencesWithNumbers.map((k) => (
                                        <a 
                                          key={k.url}
                                          href={k.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                        >
                                          {k.no}. {k.name}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
          </div>

          <div className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-500 text-sm">
            <p>{t('auto_generated_footer')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
