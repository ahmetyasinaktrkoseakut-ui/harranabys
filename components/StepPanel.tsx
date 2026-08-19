'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle2, FileText, CalendarDays, Settings, Search, TrendingUp, FileSignature, BarChart } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';
import { getAssignedLetter } from '@/lib/utils';

interface Step {
  id: string; // The puko_asamasi or step id
  title: string;
  subtitle: string;
  status: 'completed' | 'active' | 'pending';
  progress: number;
  icon: any;
  colorClass: string;
  barColorClass: string;
  href: string;
}

export default function StepPanel({ activeStepId, altOlcutId }: { activeStepId: string, altOlcutId: string }) {
  const t = useTranslations('StepPanel');
  const { selectedPeriod } = usePeriod();
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'kalite_el_kitabi',
      title: t('kalite_el_kitabi_title'),
      subtitle: t('kalite_el_kitabi_subtitle'),
      status: activeStepId === 'kalite_el_kitabi' ? 'active' : 'pending',
      progress: 0,
      icon: FileText,
      colorClass: 'text-blue-700 bg-blue-600',
      barColorClass: 'bg-blue-600',
      href: `/olcutler/${altOlcutId}/kalite-el-kitabi`
    },
    {
      id: 'planlama',
      title: t('planlama_title'),
      subtitle: t('planlama_subtitle'),
      status: activeStepId === 'planlama' ? 'active' : 'pending',
      progress: 0,
      icon: CalendarDays,
      colorClass: 'text-blue-700 bg-blue-500',
      barColorClass: 'bg-blue-500',
      href: `/olcutler/${altOlcutId}/planlama`
    },
    {
      id: 'uygulama',
      title: t('uygulama_title'),
      subtitle: t('uygulama_subtitle'),
      status: activeStepId === 'uygulama' ? 'active' : 'pending',
      progress: 0,
      icon: Settings,
      colorClass: activeStepId === 'uygulama' ? 'text-emerald-700 bg-emerald-600' : 'text-emerald-600 bg-emerald-500',
      barColorClass: 'bg-emerald-500',
      href: `/olcutler/${altOlcutId}/uygulama`
    },
    {
      id: 'kontrol',
      title: t('kontrol_title'),
      subtitle: t('kontrol_subtitle'),
      status: activeStepId === 'kontrol' ? 'active' : 'pending',
      progress: 0,
      icon: Search,
      colorClass: 'text-emerald-700 bg-emerald-500',
      barColorClass: 'bg-emerald-500',
      href: `/olcutler/${altOlcutId}/kontrol-etme`
    },
    {
      id: 'onlem',
      title: t('onlem_title'),
      subtitle: t('onlem_subtitle'),
      status: activeStepId === 'onlem' ? 'active' : 'pending',
      progress: 0,
      icon: TrendingUp,
      colorClass: 'text-orange-600 bg-orange-500',
      barColorClass: 'bg-orange-500',
      href: `/olcutler/${altOlcutId}/iyilestirme`
    },
    {
      id: 'olgunluk',
      title: t('olgunluk_title'),
      subtitle: t('olgunluk_subtitle'),
      status: activeStepId === 'olgunluk' ? 'active' : 'pending',
      progress: 0,
      icon: BarChart,
      colorClass: 'text-orange-600 bg-orange-400',
      barColorClass: 'bg-orange-400',
      href: `/olcutler/${altOlcutId}/olgunluk`
    },
    {
      id: 'rapor',
      title: t('rapor_title'),
      subtitle: t('rapor_subtitle'),
      status: activeStepId === 'rapor' ? 'active' : 'pending',
      progress: 0,
      icon: FileSignature,
      colorClass: 'text-orange-600 bg-orange-500',
      barColorClass: 'bg-orange-500',
      href: `/olcutler/${altOlcutId}/ozdegerlendirme`
    }
  ]);

  useEffect(() => {
    async function fetchProgresses() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
          const role = profile?.rol?.toLowerCase() || '';
          const isAdminOrObserver = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin') || role.includes('gözlemci') || role.includes('gozlemci');

          if (!isAdminOrObserver) {
            const { count: assignmentCount } = await supabase
              .from('kullanici_olcut_atamalari')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('alt_olcut_id', altOlcutId);

            let isAuthorized = (assignmentCount || 0) > 0;

            if (!isAuthorized) {
              const { data: currentOlcut } = await supabase.from('alt_olcutler').select('kod').eq('id', altOlcutId).maybeSingle();
              if (currentOlcut?.kod) {
                const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id);
                const assignedLetter = getAssignedLetter(coordData?.[0]?.baslik);
                if (assignedLetter && currentOlcut.kod.startsWith(assignedLetter)) {
                  isAuthorized = true;
                }
              }
            }

            if (!isAuthorized) {
              return; // Stop fetching any data if not authorized
            }
          }
        }

        // PUKO verilerini çek (1-6. adımlar için)
        const { data: pukoData } = await supabase
          .from('puko_degerlendirmeleri')
          .select('puko_asamasi, aciklama, kanit_dosyalari, durum')
          .eq('alt_olcut_id', altOlcutId)
          .eq('donem_id', selectedPeriod?.id);

        // ÖDR verisini çek (7. adım için)
        const { data: raporData } = await supabase
          .from('ozdegerlendirme_raporlari')
          .select('icerik, kanitlar, onay_durumu')
          .eq('alt_olcut_id', altOlcutId)
          .eq('donem_id', selectedPeriod?.id)
          .maybeSingle();
          
        // Kalite el kitabı verisini çek (1. adım için)
        const { data: kaliteData } = await supabase
          .from('alt_olcutler')
          .select('kalite_el_kitabi')
          .eq('id', altOlcutId)
          .maybeSingle();
          
        setSteps(prevSteps => prevSteps.map(step => {
          let progress = 0;

          if (step.id === 'rapor') {
            // 7. Buton Kontrolü
            const cleanedContent = raporData?.icerik ? raporData.icerik.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() : '';
            const hasContent = cleanedContent.length > 2;
            const hasEvidences = raporData?.kanitlar && Array.isArray(raporData.kanitlar) && raporData.kanitlar.length > 0;
            if (hasContent || hasEvidences) progress = 100;
            
            // ONAY DURUMU OVERRIDE
            if (raporData?.onay_durumu?.toLowerCase() === 'onaylandi' || raporData?.onay_durumu?.toLowerCase() === 'onaylandı') {
              progress = 100;
            }
          } else if (step.id === 'kalite_el_kitabi') {
            // 1. Buton Kontrolü (Kalite El Kitabı)
            if (kaliteData?.kalite_el_kitabi) {
              const values = Object.values(kaliteData.kalite_el_kitabi);
              const hasAnyContent = values.some((val: any) => val && typeof val === 'string' && val.trim().length > 0);
              if (hasAnyContent) progress = 100;
            }
          } else {
            // 2-6. Buton Kontrolü
            const row = pukoData?.find(r => r.puko_asamasi === step.id);
            if (row) {
              const cleanedText = row.aciklama ? row.aciklama.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() : '';
              const hasText = cleanedText.length > 2;
              const hasDoc = row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari) && row.kanit_dosyalari.length > 0;
              if (hasText || hasDoc) progress = 100;
              
              // ONAY DURUMU OVERRIDE
              if (row.durum?.toLowerCase() === 'onaylandi' || row.durum?.toLowerCase() === 'onaylandı') {
                progress = 100;
              }
            }
          }

          return {
            ...step,
            progress,
            status: activeStepId === step.id ? 'active' : (progress === 100 ? 'completed' : 'pending')
          };
        }));
      } catch (e) {
        console.error(e);
      }
    }
    fetchProgresses();
  }, [altOlcutId, activeStepId, selectedPeriod]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
      <div className="grid grid-cols-7 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = step.status === 'active';
          
          return (
            <Link href={step.href} key={step.id} className={`flex flex-col group block transition-all ${isActive ? 'scale-[1.02] transform' : 'hover:bg-slate-50'}`}>
              <div className={`
                flex-1 border rounded-lg flex flex-col overflow-hidden relative 
                ${isActive ? 'border-2 shadow-md ' + step.colorClass.split(' ')[0] : 'border-slate-200'}
              `}>
                {/* Top colored thick border if active, otherwise just bg */}
                <div className={`h-12 w-full flex items-center justify-center text-white ${step.colorClass.split(' ')[1]}`}>
                     {step.status === 'completed' ? (
                       <CheckCircle2 className="w-6 h-6" />
                     ) : (
                       <Icon className="w-6 h-6" />
                     )}
                </div>

                <div className="p-3 bg-white text-center flex-1 flex flex-col justify-between">
                  <div>
                     <h3 className={`font-bold text-[10px] sm:text-xs tracking-tight ${isActive ? step.colorClass.split(' ')[0] : 'text-slate-700'}`}>
                       {step.title}
                     </h3>
                     <p className="text-[10px] text-slate-700 mt-0.5 leading-tight">{step.subtitle}</p>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-end text-[10px] font-bold text-slate-600 mb-1">
                      {step.progress}%
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${step.barColorClass}`} style={{ width: `${step.progress}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Button representation */}
                <div className={`p-1.5 text-[10px] font-bold text-center border-t cursor-pointer
                  ${isActive 
                    ? `text-white ${step.barColorClass}` 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}
                `}>
                  {isActive ? t('edit') : (step.status === 'completed' ? t('edit') : t('enter_data'))}
                </div>
                
                {/* Arrow indicator if active */}
                {isActive && (
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-r-2 border-b-2 bg-white" style={{ borderColor: 'inherit' }}></div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
