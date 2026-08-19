'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Calendar as CalendarIcon, Building, Users, CalendarDays, ExternalLink, Download } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

interface EylemPlani {
  id: number;
  takvim: string;
  iyilestirme_alani: string;
  bulgular: string;
  eylem_faaliyet: string;
  sorumlu: string;
  basari_gostergesi: string;
  izleme_durumu: string;
  riskler: string;
  alt_olcut_id: string;
  alt_olcutler?: {
    kod: string;
    olcut_adi: string;
  };
}

export default function TakvimClient() {
  const t = useTranslations('Calendar');
  const { selectedPeriod } = usePeriod();
  const [kayitlar, setKayitlar] = useState<EylemPlani[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod) return;
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = profile?.rol?.toLowerCase() || '';
        const userIsAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        const userIsObserver = role.includes('gozlemci') || role.includes('gözlemci');
        setIsAdmin(userIsAdmin);
        setIsObserver(userIsObserver);

        let query = supabase
          .from('eylem_planlari')
          .select('*')
          .eq('donem_id', selectedPeriod.id)
          .order('id', { ascending: false });

        if (!userIsAdmin && !userIsObserver) {
          // Personel: Sadece atandığı ölçütlerin eylem planlarını görebilir
          const { data: atamalar } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('alt_olcut_id')
            .eq('user_id', user.id)
            .eq('donem_id', selectedPeriod.id);

          if (atamalar && atamalar.length > 0) {
            const allowedAltOlcutIds = atamalar.map(a => a.alt_olcut_id);
            query = query.in('alt_olcut_id', allowedAltOlcutIds);
          } else {
            setKayitlar([]);
            setIsLoading(false);
            return;
          }
        }

        const { data, error: eylemErr } = await query;
        if (eylemErr) throw eylemErr;
        
        if (data && data.length > 0) {
          // İlişkisel foreign key hatasından (PGRST200) kaçınmak için alt_olcutler tablosunu manuel fetch edip JS'de birleştiriyoruz.
          const altOlcutIds = [...new Set(data.map(item => item.alt_olcut_id))];
          const { data: olcutlerData } = await supabase
            .from('alt_olcutler')
            .select('id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar')
            .in('id', altOlcutIds);

          const olcutMap: Record<string, any> = {};
          if (olcutlerData) {
            olcutlerData.forEach(o => {
              olcutMap[o.id] = { kod: o.kod, olcut_adi: getLocalizedField(o, 'olcut_adi', locale) };
            });
          }

          // Filtreleme yapalım, sadece geçerli verisi olanları gösterelim
          const filteredData = data
            .filter((item: any) => item.takvim || item.iyilestirme_alani || item.eylem_faaliyet)
            .map((item: any) => ({
              ...item,
              alt_olcutler: olcutMap[item.alt_olcut_id] || { kod: '?', olcut_adi: t('unknown_criterion') }
            }));
            
          setKayitlar(filteredData as EylemPlani[]);
        }

      } catch (error) {
        console.error("Takvim fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedPeriod, locale, t]);

  const exportToExcel = () => {
    if (isObserver) return;
    if (!kayitlar || kayitlar.length === 0) return;

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Eylem Planları</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', 'Arial', sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e0; padding: 10px; text-align: left; vertical-align: top; font-size: 10pt; }
          th { background-color: #1e3a8a; color: white; font-weight: bold; }
          .category-header { background-color: #edf2f7; color: #1e3a8a; font-weight: bold; font-size: 11pt; border: 1px solid #cbd5e0; }
          .title { font-size: 14pt; font-weight: bold; text-align: center; padding: 15px 0; }
          .date-info { text-align: center; color: #4a5568; font-size: 9pt; padding-bottom: 20px; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="8" class="title" style="text-align: center; font-weight: bold; font-size: 14pt;">${t('title')}</td>
          </tr>
          <tr>
            <td colspan="8" class="date-info" style="text-align: center; color: #4a5568; font-size: 9pt;">${t('report_date')} ${new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')} ${new Date().toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US')}</td>
          </tr>
        </table>
        <br />
    `;

    const groupedData: Record<string, EylemPlani[]> = {};
    kayitlar.forEach(k => {
      const olcutKey = `${k.alt_olcutler?.kod || ''} - ${k.alt_olcutler?.olcut_adi || ''}`;
      if (!groupedData[olcutKey]) groupedData[olcutKey] = [];
      groupedData[olcutKey].push(k);
    });

    Object.entries(groupedData).forEach(([olcutTitle, planlar]) => {
      htmlContent += `
        <table>
          <thead>
            <tr>
              <th colspan="8" class="category-header" style="background-color: #edf2f7; color: #1e3a8a; font-weight: bold; font-size: 11pt; border: 1px solid #cbd5e0; padding: 10px;">${olcutTitle}</th>
            </tr>
            <tr>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 10%;">${t('table.date') || 'Tarih'}</th>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 15%;">${t('table.improvement_area')}</th>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 20%;">${t('table.findings')}</th>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 20%;">${t('table.action_activity')}</th>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 10%;">${t('table.responsible')}</th>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 10%;">${t('table.success_indicator')}</th>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 10%;">${t('table.riskler') || 'Riskler'}</th>
              <th style="background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e0; padding: 10px; width: 10%;">${t('table.tracking')}</th>
            </tr>
          </thead>
          <tbody>
      `;
      planlar.forEach(p => {
        htmlContent += `
          <tr>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.takvim || '-'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.iyilestirme_alani || '-'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.bulgular || '-'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.eylem_faaliyet || '-'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.sorumlu || '-'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.basari_gostergesi || '-'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.riskler || '-'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 8px; vertical-align: top;">${p.izleme_durumu || '-'}</td>
          </tr>
        `;
      });
      htmlContent += `
          </tbody>
        </table>
        <br />
      `;
    });

    htmlContent += `
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Eylem_Planlari_Raporu.xls';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="h-[calc(100vh-100px)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-blue-600" />
            {t('title')}
          </h1>
          <p className="text-slate-500 flex items-center gap-2">
            {isAdmin ? (
              <><Building className="w-4 h-4" /> {t('admin_desc')}</>
            ) : (
              <><Users className="w-4 h-4" /> {t('user_desc')}</>
            )}
          </p>
        </div>
        
        {kayitlar.length > 0 && !isObserver && (
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shrink-0"
          >
            <Download className="w-5 h-5" /> {t('export_excel')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {kayitlar.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">{t('no_plan_title')}</h3>
            <p className="text-slate-500 max-w-md">
              {t('no_plan_desc')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 pl-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[10%]">{t('table.date')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">{t('table.criterion')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">{t('table.improvement_area')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">{t('table.findings')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">{t('table.action_activity')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[10%]">{t('table.responsible')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[10%]">{t('table.success_indicator')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[10%]">Riskler</th>
                  <th className="p-4 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[10%]">{t('table.tracking')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kayitlar.map((kayit) => (
                  <tr key={kayit.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 pl-6 align-top">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 whitespace-pre-wrap max-w-[150px]">
                        {kayit.takvim || '-'}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex flex-col gap-1.5 max-w-[200px]">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-max">
                          {kayit.alt_olcutler?.kod || t('unknown_code')}
                        </span>
                        <Link 
                          href={`/olcutler/${kayit.alt_olcut_id}/planlama`}
                          className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors flex items-start gap-1 group/link"
                        >
                          <span className="line-clamp-2" title={kayit.alt_olcutler?.olcut_adi}>{kayit.alt_olcutler?.olcut_adi || t('no_criterion_name')}</span>
                          <ExternalLink className="w-3 h-3 mt-1 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                        </Link>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap max-w-[200px]">
                        {kayit.iyilestirme_alani || '-'}
                      </p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-w-[200px]">
                        {kayit.bulgular || '-'}
                      </p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-w-[200px]">
                        {kayit.eylem_faaliyet || '-'}
                      </p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-w-[150px]">
                        {kayit.sorumlu || '-'}
                      </p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-w-[150px]">
                        {kayit.basari_gostergesi || '-'}
                      </p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-w-[150px]">
                        {kayit.riskler || '-'}
                      </p>
                    </td>
                    <td className="p-4 pr-6 align-top">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-w-[150px]">
                        {kayit.izleme_durumu || '-'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
