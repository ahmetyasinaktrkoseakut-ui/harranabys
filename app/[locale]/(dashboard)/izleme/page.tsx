'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Activity, CheckCircle, Clock, FileText, BarChart3, TrendingUp, ShieldAlert, AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, X, ExternalLink } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';
import { calistirPukoStresTesti, StresTestiSonucu } from '@/lib/pukoStresTesti';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';

export default function IzlemePage() {
  const t = useTranslations('Tracking');
  const tStress = useTranslations('StressTest');
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

  // Stres Testi State
  const [isStressModalOpen, setIsStressModalOpen] = useState(false);
  const [isTestingStress, setIsTestingStress] = useState(false);
  const [stressResults, setStressResults] = useState<StresTestiSonucu | null>(null);
  const [stressActiveTab, setStressActiveTab] = useState<'odryok' | 'kanitfark' | 'bosasama' | 'ingilizceodr'>('odryok');

  const getAsamaRoute = (altOlcutId: number | string, asama: string) => {
    switch (asama) {
      case 'planlama':
        return `/olcutler/${altOlcutId}/planlama`;
      case 'uygulama':
        return `/olcutler/${altOlcutId}/uygulama`;
      case 'kontrol':
        return `/olcutler/${altOlcutId}/kontrol-etme`;
      case 'onlem':
        return `/olcutler/${altOlcutId}/iyilestirme`;
      default:
        return `/olcutler/${altOlcutId}`;
    }
  };

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

  const handleRunStressTest = async () => {
    if (!selectedPeriod) return;
    setIsTestingStress(true);
    try {
      const [pukoRes, altRes, odrRes] = await Promise.all([
        supabase
          .from('puko_degerlendirmeleri')
          .select('alt_olcut_id, durum, puko_asamasi, kanit_dosyalari, aciklama, donem_id')
          .eq('donem_id', selectedPeriod.id),
        supabase
          .from('alt_olcutler')
          .select('id, kod, olcut_adi')
          .order('kod'),
        supabase
          .from('ozdegerlendirme_raporlari')
          .select('alt_olcut_id, icerik, icerik_en, kanitlar, onay_durumu, donem_id')
          .eq('donem_id', selectedPeriod.id)
          .order('olusturulma_tarihi', { ascending: true }),
      ]);

      if (pukoRes.error || altRes.error || odrRes.error) {
        const errorMsg = pukoRes.error?.message || altRes.error?.message || odrRes.error?.message || 'Veritabanı sorgu hatası';
        console.error('Stres testi sorgu hatası:', { pukoErr: pukoRes.error, altErr: altRes.error, odrErr: odrRes.error });
        toast.error(`Stres testi çalıştırılamadı: ${errorMsg}`);
        return;
      }

      const result = calistirPukoStresTesti({
        altOlcutler: altRes.data || [],
        pukoListesi: pukoRes.data || [],
        odrListesi: odrRes.data || [],
      });
      setStressResults(result);
      if (result.odrAlinmamisOlcutler.length > 0) {
        setStressActiveTab('odryok');
      } else if (result.asamadaVarOdrdeYok.length > 0) {
        setStressActiveTab('kanitfark');
      } else {
        setStressActiveTab(result.bosAsamalar?.length > 0 ? 'bosasama' : 'ingilizceodr');
      }

      setIsStressModalOpen(true);
    } catch (err: any) {
      console.error('Stres testi hatası:', err);
      toast.error(err?.message || 'Stres testi çalıştırılırken bir hata oluştu');
    } finally {
      setIsTestingStress(false);
    }
  }

  const durumData = [
    { name: t('charts.approved'), value: stats.onaylanan, color: '#10b981' }, // emerald-500
    { name: t('charts.pending'), value: stats.bekleyen, color: '#fbbf24' },  // amber-400
    { name: t('charts.rejected'), value: stats.reddedilen, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t('title')}</h2>
          <p className="text-slate-500 mt-1 text-sm">{t('description')}</p>
        </div>
        <button
          onClick={handleRunStressTest}
          disabled={isTestingStress}
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-md transition-all self-start sm:self-auto disabled:opacity-50"
        >
          {isTestingStress ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
          {isTestingStress ? tStress('running') : tStress('title')}
        </button>
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
          {/* İAA Olgunluk Düzeyleri (A-E) Radar Grafiği */}
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

      {/* Akreditasyon Stres Testi Modalı */}
      <Dialog open={isStressModalOpen} onOpenChange={setIsStressModalOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-indigo-900 font-black">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                Akreditasyon Stres Testi (PUKÖ Bütünlük Analizi)
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                {selectedPeriod?.donem_adi || 'Seçili Dönem'} • Toplam Tespit Edilen Risk/Kusur: {stressResults?.toplamSorun || 0}
              </p>
            </div>
            <button
              onClick={() => setIsStressModalOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>

          {/* Sekmeler: Ölçüt Bazlı 3 Temel Kategori */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 shrink-0 overflow-x-auto">
            <button
              onClick={() => setStressActiveTab('odryok')}
              className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 shrink-0 ${
                stressActiveTab === 'odryok'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>1. ÖDR'ye Alınmamış Ölçütler</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                (stressResults?.odrAlinmamisOlcutler.length || 0) > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {stressResults?.odrAlinmamisOlcutler.length || 0}
              </span>
            </button>

            <button
              onClick={() => setStressActiveTab('kanitfark')}
              className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 shrink-0 ${
                stressActiveTab === 'kanitfark'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>2. Aşamalarda Kanıt Var, ÖDR'de Yok</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                (stressResults?.asamadaVarOdrdeYok.length || 0) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {stressResults?.asamadaVarOdrdeYok.length || 0}
              </span>
            </button>

            <button
              onClick={() => setStressActiveTab('bosasama')}
              className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 shrink-0 ${
                stressActiveTab === 'bosasama'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>3. Boş Aşamalar</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                (stressResults?.bosAsamalar?.length || 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {stressResults?.bosAsamalar?.length || 0}
              </span>
            </button>
            <button
              onClick={() => setStressActiveTab('ingilizceodr')}
              className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 shrink-0 ${
                stressActiveTab === 'ingilizceodr'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>4. İngilizce ÖDR Kusurları</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                (stressResults?.ingilizceOdrSorunlari?.length || 0) > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {stressResults?.ingilizceOdrSorunlari?.length || 0}
              </span>
            </button>
          </div>

          {/* Sekme İçerikleri */}
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            {stressResults?.toplamSorun === 0 ? (
              <div className="p-10 text-center bg-emerald-50 rounded-2xl border border-emerald-200">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-emerald-900">Mükemmel! Bütünlük Kusuru Bulunmadı</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  Tüm ölçütler ÖDR raporuna dahil edilmiş, PUKÖ kanıtları eksiksiz aktarılmış ve boş aşama bulunmamaktadır.
                </p>
              </div>
            ) : stressActiveTab === 'odryok' ? (
              (stressResults?.odrAlinmamisOlcutler.length || 0) === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Tüm ölçütler ÖDR raporuna alınmış durumdadır.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stressResults?.odrAlinmamisOlcutler.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-3 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-xs shrink-0">
                          {item.kod}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                          item.puko_kanit_sayisi > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {item.puko_kanit_sayisi > 0 ? `${item.puko_kanit_sayisi} Kanıt Mevcut` : 'Kanıt Yok'}
                        </span>
                        <span className="text-xs font-medium text-slate-700 truncate" title={item.olcut_adi}>
                          {item.olcut_adi}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setIsStressModalOpen(false);
                          router.push(`/olcutler/${item.alt_olcut_id}/ozdegerlendirme`);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg hover:bg-indigo-50"
                      >
                        ÖDR'ye Git <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : stressActiveTab === 'kanitfark' ? (
              (stressResults?.asamadaVarOdrdeYok.length || 0) === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Aşamalardaki tüm kanıtlar ÖDR raporunda mevcuttur.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stressResults?.asamadaVarOdrdeYok.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-3 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-mono font-bold text-xs shrink-0">
                          {item.kod}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 uppercase shrink-0">
                          {item.puko_asamasi}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={item.kanit_adi}>
                            Eksik Kanıt: {item.kanit_adi}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {item.olcut_adi}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsStressModalOpen(false);
                          router.push(`/olcutler/${item.alt_olcut_id}/ozdegerlendirme`);
                        }}
                        className="text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg hover:bg-amber-50"
                      >
                        ÖDR'ye Git <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : stressActiveTab === 'bosasama' ? (
              (stressResults?.bosAsamalar?.length || 0) === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Tüm ölçüt aşamaları eksiksiz doldurulmuştur.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stressResults?.bosAsamalar.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-3 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 font-mono font-bold text-xs shrink-0">
                          {item.kod}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                          {item.asama_adi}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={item.durum_aciklamasi}>
                            {item.durum_aciklamasi}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {item.olcut_adi}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsStressModalOpen(false);
                          router.push(getAsamaRoute(item.alt_olcut_id, item.puko_asamasi));
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg hover:bg-rose-50"
                      >
                        Aşamaya Git <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )) : (
              (stressResults?.ingilizceOdrSorunlari?.length || 0) === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">İngilizce ÖDR içeriklerinde ve kanıt bağlantılarında herhangi bir kusur bulunamadı.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stressResults?.ingilizceOdrSorunlari.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-3 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-mono font-bold text-xs shrink-0">
                          {item.kod}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                          item.sorun_tipi === 'bos_veya_kopyalanmis' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.sorun_tipi === 'bos_veya_kopyalanmis' ? 'İçerik Eksik / TR Kopyası' : 'Eksik Kanıt Bağlantısı'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={item.aciklama}>
                            {item.aciklama}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400 truncate">
                              {item.olcut_adi}
                            </span>
                            {item.eksik_kanitlar && item.eksik_kanitlar.length > 0 && (
                              <span className="inline-flex gap-1 flex-wrap">
                                {item.eksik_kanitlar.map((label, lIdx) => (
                                  <span key={lIdx} className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    {label}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsStressModalOpen(false);
                          router.push(`/olcutler/${item.alt_olcut_id}/ozdegerlendirme`);
                        }}
                        className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg hover:bg-purple-50"
                      >
                        ÖDR'ye Git <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

