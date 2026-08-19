'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, BookOpen, Search, Info, FileText, FileSpreadsheet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

export default function KaliteElKitabiRaporClient() {
  const [altOlcutler, setAltOlcutler] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const locale = useLocale();
  const t = useTranslations('QualityManualReport');
  const tKalite = useTranslations('KaliteElKitabi');
  const reportsT = useTranslations('Reports');

  useEffect(() => {
    const checkRoleAndFetch = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
          const role = profile?.rol?.toLowerCase() || '';
          const userIsAdmin = role.includes('admin') || role.includes('yönetici') || role.includes('yonetici');
          const userIsObserver = role.includes('gozlemci') || role.includes('gözlemci');
          const authorized = userIsAdmin || userIsObserver;
          
          setIsAuthorized(authorized);
          setIsObserver(userIsObserver);
          
          if (authorized) {
            await fetchData();
          } else {
            setIsLoading(false);
          }
        } else {
          window.location.href = '/login';
        }
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    };
    checkRoleAndFetch();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data } = await supabase
        .from('alt_olcutler')
        .select('*')
        .not('kalite_el_kitabi', 'is', null)
        .order('kod', { ascending: true });
      
      setAltOlcutler(data || []);
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (isObserver) return;
    if (altOlcutler.length === 0) return;
    
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${t('title').replace(/[:\/\\\?\*\[\]]/g, '').substring(0, 30)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif; margin: 0; padding: 20px; color: #1e293b; }
          h1 { text-align: left; color: #0f172a; font-size: 16pt; font-weight: bold; margin-bottom: 5px; }
          .subtitle { color: #64748b; font-size: 10pt; margin-bottom: 20px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 25px; }
          th { background-color: #1e3a8a; color: #ffffff; padding: 10px; font-weight: bold; font-size: 11pt; border: 0.5pt solid #475569; text-align: left; }
          td { padding: 8px 10px; border: 0.5pt solid #cbd5e1; font-size: 10pt; vertical-align: top; mso-number-format: "\\@"; white-space: normal; }
          td.label { background-color: #f1f5f9; font-weight: bold; width: 250px; color: #334155; }
          td.data { background-color: #ffffff; color: #0f172a; }
          td.description { background-color: #f8fafc; font-style: italic; color: #475569; padding: 10px; border: 0.5pt solid #cbd5e1; }
        </style>
      </head>
      <body>
        <h1>${t('title').toUpperCase()}</h1>
        <div class="subtitle">Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</div>
    `;

    altOlcutler.forEach((olcut, index) => {
      const data = olcut.kalite_el_kitabi;
      const cleanDescription = data.aciklama_metni ? data.aciklama_metni.replace(/\n/g, '<br/>') : '';
      const cleanDescriptionEn = data.aciklama_metni_en ? data.aciklama_metni_en.replace(/\n/g, '<br/>') : '';
      
      htmlContent += `
        <table>
          <thead>
            <tr>
              <th colspan="2" style="background-color: #1e3a8a; color: #ffffff;">${index + 1}. ${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', locale)}</th>
            </tr>
          </thead>
          <tbody>
            ${data.aciklama_metni ? `
            <tr>
              <td colspan="2" class="description"><strong>${tKalite('description_label')}:</strong><br/>${cleanDescription}</td>
            </tr>
            ` : ''}
            ${data.aciklama_metni_en ? `
            <tr>
              <td colspan="2" class="description"><strong>${tKalite('description_en_label')}:</strong><br/>${cleanDescriptionEn}</td>
            </tr>
            ` : ''}
            <tr><td class="label">${tKalite('responsible_unit')}</td><td class="data">${data.sorumlu_birim || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('first_planning_date')}</td><td class="data">${data.ilk_planlama_tarihi || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('internal_stakeholders')}</td><td class="data">${data.ic_paydaslar || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('external_stakeholders')}</td><td class="data">${data.dis_paydaslar || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('international_stakeholders')}</td><td class="data">${data.uluslararasi_paydaslar || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('application_areas')}</td><td class="data">${data.uygulama_alanlari || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('tracking_mechanisms')}</td><td class="data">${data.izleme_mekanizmalari || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('performance_indicators')}</td><td class="data">${data.performans_gostergeleri || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('eval_improvement_date')}</td><td class="data">${data.degerlendirme_iyilestirme_tarihi || t('empty_data')}</td></tr>
            <tr><td class="label">${tKalite('bgs_location')}</td><td class="data">${data.bgs_yeri || t('empty_data')}</td></tr>
          </tbody>
        </table>
        <br/>
      `;
    });

    htmlContent += `</body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Kurumsal_Kalite_El_Kitabi.xls';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWord = () => {
    if (isObserver) return;
    if (altOlcutler.length === 0) return;
    
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${t('title')}</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; padding: 20px; color: #334155; }
          h1 { text-align: center; text-transform: uppercase; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 20px; color: #1e40af; font-size: 22px; }
          .criterion-header { margin-top: 25px; margin-bottom: 10px; font-weight: bold; font-size: 14px; color: #1e40af; }
          .description-box { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 15px; font-size: 11px; color: #1e293b; border-radius: 6px; page-break-inside: avoid; break-inside: avoid; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; table-layout: fixed; page-break-inside: avoid; break-inside: avoid; }
          th.table-header { background-color: #2563eb; color: white; padding: 8px 12px; text-align: left; font-size: 14px; border: 1px solid #1e40af; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          td { vertical-align: top; line-height: 1.3; word-wrap: break-word; }
          td.label { background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; }
          td.data { background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; }
          .footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 30px; }
        </style>
      </head>
      <body>
        <h1>${t('title').toUpperCase()}</h1>
        <p style='text-align:center; color: #64748b; margin-bottom: 30px;'>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
    `;

    altOlcutler.forEach((olcut, index) => {
      const data = olcut.kalite_el_kitabi;
      const cleanDescription = data.aciklama_metni ? data.aciklama_metni.replace(/\n/g, '<br/>') : '';
      const cleanDescriptionEn = data.aciklama_metni_en ? data.aciklama_metni_en.replace(/\n/g, '<br/>') : '';
      
      htmlContent += `
        ${index > 0 ? '<br clear="all" style="page-break-before: always;" />' : ''}
        <div style="margin-top: 25px; margin-bottom: 10px; font-weight: bold; font-size: 14px; color: #1e40af; page-break-after: avoid; break-after: avoid;" class="criterion-header">
          ${index + 1}. ${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', locale)}
        </div>
        ${data.aciklama_metni ? `
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 15px; font-size: 11px; color: #1e293b; border-radius: 6px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid;" class="description-box">
          <strong>${tKalite('description_label')}:</strong><br/>
          ${cleanDescription}
        </div>
        ` : ''}
        ${data.aciklama_metni_en ? `
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 15px; font-size: 11px; color: #1e293b; border-radius: 6px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid;" class="description-box">
          <strong>${tKalite('description_en_label')}:</strong><br/>
          ${cleanDescriptionEn}
        </div>
        ` : ''}
        
        <div style="page-break-inside: avoid; break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; table-layout: fixed; page-break-inside: avoid; break-inside: avoid;" class="data-table">
            <thead>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;">
                <th colspan="2" style="background-color: #2563eb; color: white; padding: 8px 12px; text-align: left; font-size: 14px; border: 1px solid #1e40af;" class="table-header">${t('table_prefix')} ${olcut.kod} - ${getLocalizedField(olcut, 'olcut_adi', locale)}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('responsible_unit')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.sorumlu_birim || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('first_planning_date')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.ilk_planlama_tarihi || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('internal_stakeholders')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.ic_paydaslar || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('external_stakeholders')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.dis_paydaslar || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('international_stakeholders')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.uluslararasi_paydaslar || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('application_areas')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.uygulama_alanlari || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('tracking_mechanisms')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.izleme_mekanizmalari || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('performance_indicators')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.performans_gostergeleri || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('eval_improvement_date')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.degerlendirme_iyilestirme_tarihi || t('empty_data')}</td></tr>
              <tr style="page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; mso-keep-next: yes;"><td style="background-color: #2563eb; color: white; width: 30%; padding: 6px 10px; font-weight: bold; border: 1px solid #1e40af; font-size: 11px; vertical-align: top; line-height: 1.3;" class="label">${tKalite('bgs_location')}</td><td style="background-color: #f8fafc; width: 70%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; line-height: 1.3;" class="data">${data.bgs_yeri || t('empty_data')}</td></tr>
            </tbody>
          </table>
        </div>
      `;
    });

    htmlContent += `</body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Kurumsal_Kalite_El_Kitabi.doc';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-8">
        <div className="bg-red-50 p-10 rounded-3xl border border-red-200 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-700 mb-2">{reportsT('unauthorized_access')}</h2>
          <p className="text-red-500">{reportsT('unauthorized_desc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            {t('title')}
          </h2>
          <p className="text-slate-500 mt-2">{t('description')}</p>
        </div>
        {!isObserver && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button 
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" /> {t('download_excel_btn')}
            </button>
            <button 
              onClick={handleExportWord}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" /> {t('download_word_btn')}
            </button>
          </div>
        )}
      </div>

      {altOlcutler.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-100 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Henüz Veri Yok</h3>
          <p className="text-slate-500 mt-2">Henüz kalite el kitabı verisi girilmiş bir ölçüt bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-12 pb-20">
          {altOlcutler.map((olcut, index) => {
            const data = olcut.kalite_el_kitabi;
            return (
              <div key={olcut.id} className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="bg-indigo-600 p-5 text-white flex items-center justify-between">
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{t('table_prefix')} {index + 1}</span>
                    {olcut.kod} - {getLocalizedField(olcut, 'olcut_adi', locale)}
                  </h3>
                  <Info className="w-5 h-5 text-indigo-200" />
                </div>
                
                {data.aciklama_metni && (
                  <div className="p-8 bg-slate-50 border-b border-slate-100">
                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> {tKalite('description_label')}
                    </h4>
                    <div className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      {data.aciklama_metni}
                    </div>
                  </div>
                )}
                <table className="w-full border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      [tKalite('responsible_unit'), data.sorumlu_birim],
                      [tKalite('first_planning_date'), data.ilk_planlama_tarihi],
                      [tKalite('internal_stakeholders'), data.ic_paydaslar],
                      [tKalite('external_stakeholders'), data.dis_paydaslar],
                      [tKalite('international_stakeholders'), data.uluslararasi_paydaslar],
                      [tKalite('application_areas'), data.uygulama_alanlari],
                      [tKalite('tracking_mechanisms'), data.izleme_mekanizmalari],
                      [tKalite('performance_indicators'), data.performans_gostergeleri],
                      [tKalite('eval_improvement_date'), data.degerlendirme_iyilestirme_tarihi],
                      [tKalite('bgs_location'), data.bgs_yeri]
                    ].map(([label, value], i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="w-1/3 p-4 bg-indigo-50/30 text-indigo-900 font-bold text-sm border-r border-indigo-50/50">{label}</td>
                        <td className="p-4 text-slate-700 text-sm whitespace-pre-wrap">{value || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
