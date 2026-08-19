'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Activity, CheckCircle, Clock, FileText, BarChart3, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';

export default function IzlemePage() {
  const t = useTranslations('Tracking');
  const router = useRouter();
  const { selectedPeriod } = usePeriod();
  const [stats, setStats] = useState({
    toplamOlcut: 0,
    bekleyen: 0,
    onaylanan: 0,
    reddedilen: 0,
    toplamDokuman: 0,
  });
  
  const [pukoDistribution, setPukoDistribution] = useState<any[]>([]);
  const [radarData, setRadarData] = useState<any[]>([]);
  const [isRadarFallback, setIsRadarFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!selectedPeriod) return;
      try {
        setIsLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
          const role = profile?.rol?.toLowerCase() || '';
          if (!role.includes('yonetici') && !role.includes('yönetici') && !role.includes('admin') && !role.includes('gozlemci') && !role.includes('gözlemci')) {
            router.replace('/olcutler');
            return;
          }
        } else {
          router.replace('/login');
          return;
        }

        const { count: countOlcut } = await supabase.from('alt_olcutler').select('*', { count: 'exact', head: true });
        
        const { data: pukoData } = await supabase
          .from('puko_degerlendirmeleri')
          .select('alt_olcut_id, durum, puko_asamasi, kanit_dosyalari, olgunluk_puani, alt_olcutler(kod)')
          .eq('donem_id', selectedPeriod.id);

        let bekleyen = 0;
        let onaylanan = 0;
        let reddedilen = 0;
        let toplamDokuman = 0;
        const pukoCounts: Record<string, number> = {};

        // Group by A, B, C, D, E for maturity ratings
        const radarSums: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        const radarCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

        // Support draft/pending fallback if there are no approved ones
        const radarSumsAll: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        const radarCountsAll: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

        // Group statuses by unique alt_olcut_id
        const olcutStatusMap: Record<string, Set<string>> = {};

        if (pukoData) {
          pukoData.forEach(row => {
            const olcutId = (row as any).alt_olcut_id;
            if (olcutId) {
              if (!olcutStatusMap[olcutId]) {
                olcutStatusMap[olcutId] = new Set();
              }
              if (row.durum) {
                olcutStatusMap[olcutId].add(row.durum);
              }
            }

            if (row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari)) {
              toplamDokuman += row.kanit_dosyalari.length;
            }

            const asama = row.puko_asamasi || t('charts.no_data_short');
            pukoCounts[asama] = (pukoCounts[asama] || 0) + 1;

            if (row.puko_asamasi === 'olgunluk') {
              const altOlcut = row.alt_olcutler;
              const rawKod = altOlcut
                ? (Array.isArray(altOlcut)
                    ? altOlcut[0]?.kod
                    : (altOlcut as any).kod)
                : null;
              const codePrefix = rawKod ? rawKod.split('.')[0] : null;
              if (codePrefix && radarSums[codePrefix] !== undefined) {
                const score = row.olgunluk_puani || 0;
                if (score > 0) {
                  radarSumsAll[codePrefix] += score;
                  radarCountsAll[codePrefix] += 1;

                  if (row.durum === 'Onaylandı') {
                    radarSums[codePrefix] += score;
                    radarCounts[codePrefix] += 1;
                  }
                }
              }
            }
          });

          // Calculate unique criterion status counts
          Object.values(olcutStatusMap).forEach(statusSet => {
            if (statusSet.has('Beklemede')) {
              bekleyen++;
            } else if (statusSet.has('Reddedildi')) {
              reddedilen++;
            } else if (statusSet.has('Onaylandı')) {
              onaylanan++;
            }
          });
        }

        setStats({
          toplamOlcut: countOlcut || 0,
          bekleyen,
          onaylanan,
          reddedilen,
          toplamDokuman
        });

        const distArray = Object.keys(pukoCounts).map(k => ({
          name: k.replace('_', ' ').toUpperCase(),
          value: pukoCounts[k]
        }));
        setPukoDistribution(distArray);

        // Determine fallback usage
        const totalApprovedMaturities = Object.values(radarCounts).reduce((sum, c) => sum + c, 0);
        const useFallback = totalApprovedMaturities === 0;

        const activeSums = useFallback ? radarSumsAll : radarSums;
        const activeCounts = useFallback ? radarCountsAll : radarCounts;

        const radarChartData = Object.keys(activeSums).map(key => {
          const avg = activeCounts[key] > 0 ? (activeSums[key] / activeCounts[key]) : 0;
          let topicName = key;
          try {
            topicName = t(`topics.${key}`);
          } catch (e) {
            if (key === 'A') topicName = 'Kalite Güvencesi';
            if (key === 'B') topicName = 'Eğitim ve Öğretim';
            if (key === 'C') topicName = 'Araştırma ve Geliştirme';
            if (key === 'D') topicName = 'Toplumsal Katkı';
            if (key === 'E') topicName = 'Yönetim Sistemi';
          }
          return {
            subject: topicName,
            value: parseFloat(avg.toFixed(2)),
            fullMark: 5
          };
        });

        setRadarData(radarChartData);
        setIsRadarFallback(useFallback && Object.values(radarCountsAll).reduce((sum, c) => sum + c, 0) > 0);

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, [selectedPeriod]);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  const durumData = [
    { name: t('charts.approved'), value: stats.onaylanan, color: '#10b981' }, // emerald-500
    { name: t('charts.pending'), value: stats.bekleyen, color: '#fbbf24' },  // amber-400
    { name: t('charts.rejected'), value: stats.reddedilen, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t('title')}</h2>
        <p className="text-slate-500 mt-1 text-sm">{t('description')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 hover-card-effect cursor-pointer">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('stats.total_criteria')}</p>
            <p className="text-2xl font-bold text-slate-800">{stats.toplamOlcut}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 hover-card-effect cursor-pointer">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('stats.pending_approval')}</p>
            <p className="text-2xl font-bold text-slate-800">{stats.bekleyen}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 hover-card-effect cursor-pointer">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('stats.approved_process')}</p>
            <p className="text-2xl font-bold text-slate-800">{stats.onaylanan}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 hover-card-effect cursor-pointer">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('stats.uploaded_documents')}</p>
            <p className="text-2xl font-bold text-slate-800">{stats.toplamDokuman}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover-card-effect">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            {t('charts.data_entry_by_phase')}
          </h3>
          <div className="h-72 w-full">
            {pukoDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pukoDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px', fill: 'var(--text-muted)' }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: 'var(--text-muted)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--background)' }}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text-main)'
                    }}
                  />
                  <Bar dataKey="value" fill="#9e7f59" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-slate-400">{t('charts.no_data')}</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover-card-effect relative">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            {t('charts.maturity_radar')}
          </h3>
          {isRadarFallback && (
            <span className="inline-block text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full mb-4 font-semibold">
              ⚠️ {t('charts.draft_pending_included')}
            </span>
          )}
          <div className="h-72 w-full flex items-center justify-center mt-2">
            {radarData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="var(--card-border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
                  <Radar name="Skor" dataKey="value" stroke="#9e7f59" fill="#9e7f59" fillOpacity={0.3} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text-main)'
                    }} 
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-center">{t('charts.no_maturity_data')}</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover-card-effect">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            {t('charts.process_approval_status')}
          </h3>
          <div className="h-72 w-full flex items-center justify-center">
             {durumData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={durumData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {durumData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text-main)'
                    }} />
                  </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <PieChart className="w-16 h-16 opacity-30 mb-2" />
                  {t('charts.no_data_short')}
                </div>
             )}
          </div>
          {durumData.length > 0 && (
            <div className="flex justify-center gap-6 mt-2">
              {durumData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                  {d.name}: <span className="font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

