'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Info, Download, FileText } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import StepPanel from '@/components/StepPanel';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';
import { logAction } from '@/lib/logger';
import { getAssignedLetter } from '@/lib/utils';

interface KaliteData {
  sorumlu_birim: string;
  ilk_planlama_tarihi: string;
  ic_paydaslar: string;
  dis_paydaslar: string;
  uluslararasi_paydaslar: string;
  uygulama_alanlari: string;
  izleme_mekanizmalari: string;
  performans_gostergeleri: string;
  degerlendirme_iyilestirme_tarihi: string;
  bgs_yeri: string;
  aciklama_metni?: string;
  aciklama_metni_en?: string;
}

const initialData: KaliteData = {
  sorumlu_birim: '',
  ilk_planlama_tarihi: '',
  ic_paydaslar: '',
  dis_paydaslar: '',
  uluslararasi_paydaslar: '',
  uygulama_alanlari: '',
  izleme_mekanizmalari: '',
  performans_gostergeleri: '',
  degerlendirme_iyilestirme_tarihi: '',
  bgs_yeri: '',
  aciklama_metni: '',
  aciklama_metni_en: '',
};

export default function KaliteElKitabiClient({ params }: { params?: Promise<{ id: string }> }) {
  const resolvedParams = params ? use(params) : null;
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [formData, setFormData] = useState<KaliteData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const tPhase = useTranslations('Phase');
  const t = useTranslations('KaliteElKitabi');
  const locale = useLocale();
  const router = useRouter();
  const { selectedPeriod } = usePeriod();

  useEffect(() => {
    if (resolvedParams?.id) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [resolvedParams?.id, selectedPeriod]);

  const fetchData = async () => {
    if (!selectedPeriod || !resolvedParams?.id) return;
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = profile?.rol?.toLowerCase() || '';
        const isAdminOrObserver = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin') || role.includes('gözlemci') || role.includes('gozlemci');

        if (isAdminOrObserver || selectedPeriod?.is_active === false) {
          setIsReadOnly(true);
        }

        if (!isAdminOrObserver) {
          const { count: assignmentCount } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('alt_olcut_id', resolvedParams.id);

          let isAuthorized = (assignmentCount || 0) > 0;

          if (!isAuthorized) {
            const { data: currentOlcut } = await supabase.from('alt_olcutler').select('kod').eq('id', resolvedParams.id).maybeSingle();
            if (currentOlcut?.kod) {
              const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id);
              const assignedLetter = getAssignedLetter(coordData?.[0]?.baslik);
              if (assignedLetter && currentOlcut.kod.startsWith(assignedLetter)) {
                isAuthorized = true;
              }
            }
          }

          if (!isAuthorized) {
            router.replace('/olcutler');
            return;
          }
        }
      }
      
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams?.id).maybeSingle();
      if (olcut) {
        setOlcutDetay(olcut);
        if (olcut.kalite_el_kitabi) {
          setFormData({ ...initialData, ...olcut.kalite_el_kitabi });
        }
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof KaliteData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!resolvedParams?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('alt_olcutler')
        .update({ 
          kalite_el_kitabi: {
            sorumlu_birim: formData.sorumlu_birim,
            ilk_planlama_tarihi: formData.ilk_planlama_tarihi,
            ic_paydaslar: formData.ic_paydaslar,
            dis_paydaslar: formData.dis_paydaslar,
            uluslararasi_paydaslar: formData.uluslararasi_paydaslar,
            uygulama_alanlari: formData.uygulama_alanlari,
            izleme_mekanizmalari: formData.izleme_mekanizmalari,
            performans_gostergeleri: formData.performans_gostergeleri,
            degerlendirme_iyilestirme_tarihi: formData.degerlendirme_iyilestirme_tarihi,
            bgs_yeri: formData.bgs_yeri,
            aciklama_metni: formData.aciklama_metni,
            aciklama_metni_en: formData.aciklama_metni_en || ''
          }
        })
        .eq('id', resolvedParams.id);

      if (error) throw error;

      await logAction({
        supabase,
        islemTipi: 'UPDATE',
        tabloAdi: 'alt_olcutler (kalite_el_kitabi)',
        kayitId: resolvedParams.id,
        yeniVeri: { alt_olcut_id: resolvedParams.id, kalite_el_kitabi: formData }
      });

      alert(t('save_success'));
    } catch (error: any) {
      console.error('Save Error:', error);
      alert(`${t('save_error')}${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  const labelStyle = "bg-indigo-600 text-white p-5 font-bold text-sm border-b border-indigo-500/50 flex items-center";
  const inputStyle = "w-full h-full p-5 text-sm bg-transparent border-none outline-none focus:bg-indigo-50/10 transition-colors disabled:opacity-80 resize-none block";

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-700 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">Ana Sayfa</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">Ölçütler</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ')}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {t('title')}
            </h2>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {resolvedParams?.id && <StepPanel activeStepId="kalite_el_kitabi" altOlcutId={resolvedParams.id} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <label className="block text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            {t('description_label')}
          </label>
          <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <textarea
              value={formData.aciklama_metni}
              onChange={(e) => handleInputChange('aciklama_metni', e.target.value)}
              disabled={isReadOnly}
              rows={12}
              className="w-full p-8 text-slate-700 bg-transparent border-none outline-none resize-y min-h-[300px] leading-relaxed font-medium placeholder:text-slate-300"
              placeholder={t('placeholder')}
            />
          </div>
        </div>

        <div>
          <label className="block text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            {t('description_en_label')}
          </label>
          <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <textarea
              value={formData.aciklama_metni_en || ''}
              onChange={(e) => handleInputChange('aciklama_metni_en', e.target.value)}
              disabled={isReadOnly}
              rows={12}
              className="w-full p-8 text-slate-700 bg-transparent border-none outline-none resize-y min-h-[300px] leading-relaxed font-medium placeholder:text-slate-300"
              placeholder={t('placeholder_en')}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden mb-10">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr>
              <th colSpan={2} className="bg-indigo-600 text-white p-6 text-2xl font-black text-left tracking-tight border-b border-indigo-500">
                {t('table_title')} {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className={labelStyle} style={{width: '280px'}}>{t('responsible_unit')}</td>
              <td className="p-0 align-stretch">
                <input 
                  type="text" 
                  value={formData.sorumlu_birim} 
                  onChange={(e) => handleInputChange('sorumlu_birim', e.target.value)}
                  disabled={isReadOnly}
                  className={inputStyle}
                  placeholder={t('placeholder_unit')}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('first_planning_date')}</td>
              <td className="p-0 align-stretch">
                <input 
                  type="date" 
                  value={formData.ilk_planlama_tarihi} 
                  onChange={(e) => handleInputChange('ilk_planlama_tarihi', e.target.value)}
                  disabled={isReadOnly}
                  className={inputStyle}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('internal_stakeholders')}</td>
              <td className="p-0 align-stretch">
                <textarea 
                  value={formData.ic_paydaslar} 
                  onChange={(e) => handleInputChange('ic_paydaslar', e.target.value)}
                  disabled={isReadOnly}
                  rows={4}
                  className={inputStyle}
                  placeholder={t('placeholder_internal')}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('external_stakeholders')}</td>
              <td className="p-0 align-stretch">
                <textarea 
                  value={formData.dis_paydaslar} 
                  onChange={(e) => handleInputChange('dis_paydaslar', e.target.value)}
                  disabled={isReadOnly}
                  rows={4}
                  className={inputStyle}
                  placeholder={t('placeholder_external')}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('international_stakeholders')}</td>
              <td className="p-0 align-stretch">
                <textarea 
                  value={formData.uluslararasi_paydaslar} 
                  onChange={(e) => handleInputChange('uluslararasi_paydaslar', e.target.value)}
                  disabled={isReadOnly}
                  rows={4}
                  className={inputStyle}
                  placeholder={t('placeholder_international')}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('application_areas')}</td>
              <td className="p-0 align-stretch">
                <textarea 
                  value={formData.uygulama_alanlari} 
                  onChange={(e) => handleInputChange('uygulama_alanlari', e.target.value)}
                  disabled={isReadOnly}
                  rows={4}
                  className={inputStyle}
                  placeholder={t('placeholder_areas')}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('tracking_mechanisms')}</td>
              <td className="p-0 align-stretch">
                <textarea 
                  value={formData.izleme_mekanizmalari} 
                  onChange={(e) => handleInputChange('izleme_mekanizmalari', e.target.value)}
                  disabled={isReadOnly}
                  rows={4}
                  className={inputStyle}
                  placeholder={t('placeholder_tracking')}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('performance_indicators')}</td>
              <td className="p-0 align-stretch">
                <textarea 
                  value={formData.performans_gostergeleri} 
                  onChange={(e) => handleInputChange('performans_gostergeleri', e.target.value)}
                  disabled={isReadOnly}
                  rows={4}
                  className={inputStyle}
                  placeholder={t('placeholder_indicators')}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle}>{t('eval_improvement_date')}</td>
              <td className="p-0 align-stretch">
                <input 
                  type="date" 
                  value={formData.degerlendirme_iyilestirme_tarihi} 
                  onChange={(e) => handleInputChange('degerlendirme_iyilestirme_tarihi', e.target.value)}
                  disabled={isReadOnly}
                  className={inputStyle}
                />
              </td>
            </tr>
            <tr>
              <td className={labelStyle + " border-b-0"}>{t('bgs_location')}</td>
              <td className="p-0 align-stretch">
                <textarea 
                  value={formData.bgs_yeri} 
                  onChange={(e) => handleInputChange('bgs_yeri', e.target.value)}
                  disabled={isReadOnly}
                  rows={4}
                  className={inputStyle + " border-b-0"}
                  placeholder={t('placeholder_bgs')}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!isReadOnly && (
        <div className="flex justify-end mb-10">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-3xl font-black transition-all shadow-xl hover:scale-105 active:scale-95 disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            {isSaving ? t('saving') : t('save')}
          </button>
        </div>
      )}
    </div>
  );
}
