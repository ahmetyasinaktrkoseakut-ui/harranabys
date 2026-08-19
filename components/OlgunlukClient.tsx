'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Info, Save, Settings, Star } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import { logAction } from '@/lib/logger';
import RichTextEditor from '@/components/RichTextEditor';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';
import { getAssignedLetter } from '@/lib/utils';

interface OlgunlukClientProps {
  params: Promise<{ id: string }>;
}

export default function OlgunlukClient({ params }: OlgunlukClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [aciklama, setAciklama] = useState('');
  const [olgunlukPuani, setOlgunlukPuani] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('Maturity');
  const tPhase = useTranslations('Phase');
  const tCommon = useTranslations('Common');
  const { selectedPeriod } = usePeriod();

  const fetchData = async () => {
    if (!selectedPeriod) return;
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
      
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).maybeSingle();
      if (olcut) setOlcutDetay(olcut);

      const { data: pukoData } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'olgunluk')
        .eq('donem_id', selectedPeriod?.id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pukoData) {
        setAciklama(pukoData.aciklama || '');
        setOlgunlukPuani(pukoData.olgunluk_puani || 0);
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id, selectedPeriod]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const upsertData: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: 'olgunluk',
        donem_id: selectedPeriod?.id,
        aciklama: aciklama,
        olgunluk_puani: olgunlukPuani,
        durum: 'Taslak',
        red_nedeni: null
      };
      
      const { data: existingRecord } = await supabase
        .from('puko_degerlendirmeleri')
        .select('id')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'olgunluk')
        .eq('donem_id', selectedPeriod?.id)
        .maybeSingle();

      if (existingRecord?.id) {
        const { error: updateErr } = await supabase
          .from('puko_degerlendirmeleri')
          .update(upsertData)
          .eq('id', existingRecord.id);
        if (updateErr) throw updateErr;

        await logAction({
          supabase,
          islemTipi: 'UPDATE',
          tabloAdi: 'puko_degerlendirmeleri',
          kayitId: existingRecord.id,
          yeniVeri: upsertData
        });
      } else {
        const { data: newRec, error: insertErr } = await supabase
          .from('puko_degerlendirmeleri')
          .insert(upsertData)
          .select('id')
          .maybeSingle();
        if (insertErr) throw insertErr;

        await logAction({
          supabase,
          islemTipi: 'INSERT',
          tabloAdi: 'puko_degerlendirmeleri',
          kayitId: newRec?.id,
          yeniVeri: upsertData
        });
      }

      alert(t('save_success'));
      fetchData(); 
    } catch (error: any) {
      console.error('Save Error:', error);
      alert(`${tPhase('save_error')}: ${error.message || 'Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

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

  const gecerliAciklama = getDuzeyAciklamasi(olcutDetay, olgunlukPuani, locale);

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-700 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">{tPhase('home')}</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">{tPhase('criteria')}</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
            </h2>
            <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
          </div>
          <p className="text-sm text-slate-800">{t('description')}</p>
        </div>
      </div>

      <StepPanel activeStepId="olgunluk" altOlcutId={resolvedParams.id} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-8 border-b border-slate-200 flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-white">
          <h3 className="text-xl font-bold text-slate-800 mb-6">{t('title')}</h3>
          <div className="flex items-center justify-center gap-4 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={isReadOnly}
                onClick={() => setOlgunlukPuani(star)}
                className={`transition-all duration-300 transform hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                  olgunlukPuani >= star ? 'text-amber-400 drop-shadow-md' : 'text-slate-200'
                }`}
              >
                <Star className={`w-14 h-14 ${olgunlukPuani >= star ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
          <div className="min-h-[80px] w-full max-w-3xl mt-4 flex flex-col items-center">
            {olgunlukPuani > 0 ? (
              gecerliAciklama ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 shadow-sm w-full">
                  <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-bold text-amber-800 text-sm mb-1">
                      {t('points', { puan: olgunlukPuani })}
                    </p>
                    <p className="text-amber-700 text-sm leading-relaxed">
                      {gecerliAciklama}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-amber-600 font-semibold text-center animate-in fade-in slide-in-from-bottom-2">
                  {t('points', { puan: olgunlukPuani })}
                </p>
              )
            ) : (
               <p className="text-slate-400 font-medium text-center italic mt-6">{t('select_point')}</p>
            )}
          </div>
        </div>

        <div className="p-6">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-4 text-sm">
            <Settings className="w-4 h-4 text-orange-600" />
            {t('justification')}
            {isReadOnly && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200">{tCommon('readOnly')}</span>}
          </h3>
          <div className="w-full">
            <RichTextEditor content={aciklama} onChange={setAciklama} readOnly={isReadOnly} />
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex justify-end p-6 pt-0 mt-4 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={handleSave}
              disabled={isSaving || olgunlukPuani === 0}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? tPhase('saving') : t('save_button')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
