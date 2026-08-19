'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Search, Calendar, User, Eye, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { getAssignedLetter } from '@/lib/utils';

interface LogEntry {
  id: string;
  user_id: string;
  islem_tipi: string;
  tablo_adi: string;
  kayit_id: string;
  eski_veri: any;
  yeni_veri: any;
  tarih: string;
  detay?: string;
  
  // Mapped client-side
  userName?: string;
  userRole?: string;
  criterionKod?: string;
  criterionName?: string;
  alt_olcut_id?: string;
}

export default function AktiviteGunluguPage() {
  const t = useTranslations('AuditLog');
  const tNav = useTranslations('Navigation');
  const tRoles = useTranslations('Roles');
  const tTracking = useTranslations('Tracking');
  const locale = useLocale();
  const router = useRouter();

  const getLocalizedRole = (roleStr?: string) => {
    if (!roleStr) return tRoles('user');
    const normalized = roleStr.toLowerCase().replace(/\s+/g, '');
    if (normalized.includes('yonetici') || normalized.includes('yönetici') || normalized.includes('admin')) {
      return tRoles('admin');
    }
    if (normalized.includes('birimsorumlusu') || normalized.includes('birimyoneticisi') || normalized.includes('unitadmin')) {
      return tRoles('unit_admin');
    }
    if (normalized.includes('gozlemci') || normalized.includes('gözlemci') || normalized.includes('observer')) {
      return tRoles('observer');
    }
    if (normalized.includes('koordinator') || normalized.includes('koordinatör') || normalized.includes('coordinator')) {
      return tRoles('coordinator');
    }
    return tRoles('user');
  };

  // Context hook for period changes
  const { selectedPeriod } = usePeriodContext();
  
  // Fallback if usePeriodContext is not imported (using simple state)
  function usePeriodContext() {
    try {
      return require('@/contexts/PeriodContext').usePeriod();
    } catch (_) {
      return { selectedPeriod: null };
    }
  }

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; role: string }>>({});
  const [criteria, setCriteria] = useState<Record<string, { kod: string; name: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedHeading, setSelectedHeading] = useState('');
  const [assignedTopicLetter, setAssignedTopicLetter] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const logsPerPage = 15;

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        // Check user role
        const { data: profile } = await supabase
          .from('profiller')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle();

        const role = (profile?.rol || '').toLowerCase();
        const adminCheck = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        setIsAdmin(adminCheck);

        // Check coordinator headings
        const { data: coordData } = await supabase
          .from('baslik_koordinatorleri')
          .select('baslik')
          .eq('kullanici_id', user.id);

        const hasCoordinatorRecord = coordData && coordData.length > 0;
        const letter = hasCoordinatorRecord ? getAssignedLetter(coordData[0]?.baslik) : null;
        setAssignedTopicLetter(letter);

        if (adminCheck || hasCoordinatorRecord) {
          setIsAuthorized(true);
          await loadData(letter, adminCheck);
        } else {
          setIsAuthorized(false);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Auth Check Error:', err);
        setIsAuthorized(false);
        setIsLoading(false);
      }
    }

    checkAuthAndLoad();
  }, [selectedPeriod]);

  async function loadData(letterFilter: string | null, adminMode: boolean) {
    try {
      // 1. Fetch profiles for user mapping
      const { data: profData } = await supabase
        .from('profiller')
        .select('id, ad_soyad, rol');
      
      const profMap: Record<string, { name: string; role: string }> = {};
      if (profData) {
        profData.forEach(p => {
          profMap[p.id] = {
            name: p.ad_soyad || 'Bilinmeyen Kullanıcı',
            role: p.rol || 'Personel'
          };
        });
      }
      setProfiles(profMap);

      // 2. Fetch alt_olcutler for criterion mapping
      const { data: critData } = await supabase
        .from('alt_olcutler')
        .select('id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar');

      const critMap: Record<string, { kod: string; name: string }> = {};
      if (critData) {
        critData.forEach(c => {
          let name = c.olcut_adi;
          if (locale === 'en' && c.olcut_adi_en) name = c.olcut_adi_en;
          if (locale === 'ar' && c.olcut_adi_ar) name = c.olcut_adi_ar;
          critMap[c.id.toString()] = {
            kod: c.kod || '',
            name: name || ''
          };
        });
      }
      setCriteria(critMap);

      // 3. Fetch system logs
      const { data: logData, error } = await supabase
        .from('system_islem_loglari')
        .select('*')
        .order('tarih', { ascending: false });

      if (error) throw error;

      if (logData) {
        const mappedLogs: LogEntry[] = logData.map(log => {
          const uMap = profMap[log.user_id];
          
          // Try to find alt_olcut_id from JSON data
          let alt_olcut_id = log.yeni_veri?.alt_olcut_id || log.eski_veri?.alt_olcut_id;
          
          // Fallback parsing for document deletion URLs e.g. public/dokumanlar/37_planlama
          if (!alt_olcut_id && log.tablo_adi && log.tablo_adi.includes('dokumanlar')) {
            const url = log.yeni_veri?.url || log.eski_veri?.url || '';
            const match = /\/dokumanlar\/(\d+)_/i.exec(url);
            if (match && match[1]) {
              alt_olcut_id = match[1];
            }
          }

          const cMap = alt_olcut_id ? critMap[alt_olcut_id.toString()] : null;

          return {
            ...log,
            userName: uMap ? uMap.name : null,
            userRole: uMap ? uMap.role : null,
            criterionKod: cMap?.kod || '',
            criterionName: cMap?.name || '',
            alt_olcut_id: alt_olcut_id?.toString()
          };
        });

        // Filter by Coordinator scope (A, B, C, D, E) if not admin
        let finalLogs = mappedLogs;
        if (!adminMode && letterFilter) {
          finalLogs = mappedLogs.filter(log => log.criterionKod && log.criterionKod.startsWith(letterFilter));
        }

        setLogs(finalLogs);
      }
    } catch (err) {
      console.error('Data Load Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Format details text dynamically
  const formatDetail = (log: LogEntry) => {
    if (log.detay) return log.detay;

    const action = log.islem_tipi;
    const table = log.tablo_adi || '';
    
    if (table.includes('puko_degerlendirmeleri')) {
      const data = log.yeni_veri || log.eski_veri || {};
      
      const phaseKey = data.puko_asamasi || '';
      let phaseStr = phaseKey;
      try {
        phaseStr = t(`details.puko_phases.${phaseKey}`);
      } catch (_) {
        const asamaMap: Record<string, string> = {
          planlama: 'Planlama (P)',
          uygulama: 'Uygulama (U)',
          kontrol: 'Kontrol Etme (K)',
          onlem: 'Önlem Alma (O)',
          olgunluk: 'Olgunluk Düzeyi'
        };
        phaseStr = asamaMap[phaseKey] || phaseKey;
      }

      const statusRaw = (data.durum || '').toLowerCase();
      let statusStr = data.durum || '';
      if (statusRaw === 'taslak') statusStr = t('details.statuses.taslak');
      else if (statusRaw === 'beklemede') statusStr = t('details.statuses.beklemede');
      else if (statusRaw === 'onaylandi' || statusRaw === 'onaylandı') statusStr = t('details.statuses.onaylandi');
      else if (statusRaw === 'reddedildi') statusStr = t('details.statuses.reddedildi');

      if (action === 'INSERT') {
        return t('details.puko_insert', { phase: phaseStr, status: statusStr });
      }
      return t('details.puko_update', { phase: phaseStr, status: statusStr });
    }

    if (table.includes('dokumanlar')) {
      const data = log.yeni_veri || log.eski_veri || {};
      const fileName = data.name || 'dosya';
      if (action === 'DELETE') {
        return t('details.evidence_delete', { fileName });
      }
      return t('details.evidence_upload', { fileName });
    }

    if (table.includes('ozdegerlendirme_raporlari')) {
      const data = log.yeni_veri || log.eski_veri || {};
      const reason = data.red_nedeni || t('details.no_reason');
      
      const tableActionKey = table.includes('onay') ? 'approved' : table.includes('red') ? 'rejected' : 'updated';
      const localizedAction = t(`details.${tableActionKey}`);

      if (table.includes('red')) {
         return t('details.self_evaluation_reject', { reason });
      }
      return t('details.self_evaluation_action', { action: localizedAction });
    }

    if (table.includes('alt_olcutler') && table.includes('kalite_el_kitabi')) {
      return t('details.quality_manual_update');
    }

    if (table.includes('donemler')) {
      const data = log.yeni_veri || log.eski_veri || {};
      const name = data.donem_adi || '';
      if (action === 'SEAL') {
        return t('details.period_seal', { name });
      }
      return t('details.period_update', { name });
    }

    return t('details.generic_action', { table, action });
  };

  // Perform client-side searching and filtering
  const filteredLogs = logs.filter(log => {
    // Search filter
    const matchesSearch = log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.criterionKod?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Action filter
    const matchesAction = selectedAction === '' || log.islem_tipi === selectedAction;
    
    // Topic Heading filter (A-E)
    let matchesHeading = true;
    if (selectedHeading !== '') {
      matchesHeading = log.criterionKod ? log.criterionKod.startsWith(selectedHeading) : false;
    }

    return matchesSearch && matchesAction && matchesHeading;
  });

  // Paginated Logs
  const paginatedLogs = filteredLogs.slice(
    currentPage * logsPerPage,
    (currentPage + 1) * logsPerPage
  );

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50';
      case 'UPDATE':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50';
      case 'DELETE':
        return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50';
      case 'SEAL':
        return 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50';
      default:
        return 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
    }
  };

  if (isLoading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <span className="text-sm font-semibold text-slate-500">{t('loading')}</span>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-20 text-center animate-fade-in-up">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t('unauthorized')}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          {t('unauthorized_desc')}
        </p>
        <button 
          onClick={() => router.replace('/olcutler')}
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all cursor-pointer"
        >
          {t('back_to_home')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{t('title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{t('description')}</p>
        </div>
        <button 
          onClick={() => loadData(assignedTopicLetter, isAdmin)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#0f1e36] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-200 dark:hover:border-slate-700 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          {t('refresh')}
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-[#0f1e36] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3" />
            <input 
              type="text"
              placeholder={t('user_search_placeholder')}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-[#0a1324] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 text-sm transition-all"
            />
          </div>

          {/* Action Type filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setCurrentPage(0); }}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a1324] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 text-sm text-slate-700 dark:text-slate-300 transition-all"
            >
              <option value="">-- {t('action_type_placeholder')} --</option>
              <option value="INSERT">{t('action_types.INSERT')}</option>
              <option value="UPDATE">{t('action_types.UPDATE')}</option>
              <option value="DELETE">{t('action_types.DELETE')}</option>
              <option value="SEAL">{t('action_types.SEAL')}</option>
            </select>
          </div>

          {/* Heading Letter filter (only fully visible to Admins. Coordinators are locked to their topic letter) */}
          {isAdmin ? (
            <div>
              <select
                value={selectedHeading}
                onChange={(e) => { setSelectedHeading(e.target.value); setCurrentPage(0); }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a1324] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 text-sm text-slate-700 dark:text-slate-300 transition-all"
              >
                <option value="">-- {t('heading_placeholder')} --</option>
                <option value="A">A - {tTracking('topics.A')}</option>
                <option value="B">B - {tTracking('topics.B')}</option>
                <option value="C">C - {tTracking('topics.C')}</option>
                <option value="D">D - {tTracking('topics.D')}</option>
                <option value="E">E - {tTracking('topics.E')}</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('responsible_heading_locked', { letter: assignedTopicLetter || '' })}
            </div>
          )}
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="bg-white dark:bg-[#0f1e36] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0d1b30] border-b border-slate-100 dark:border-slate-800/80">
                <th className="p-5 font-bold text-slate-600 dark:text-slate-400 text-sm tracking-tight w-[180px]">
                  <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {t('timestamp')}</span>
                </th>
                <th className="p-5 font-bold text-slate-600 dark:text-slate-400 text-sm tracking-tight w-[200px]">
                  <span className="flex items-center gap-2"><User className="w-4 h-4" /> {t('user')}</span>
                </th>
                <th className="p-5 font-bold text-slate-600 dark:text-slate-400 text-sm tracking-tight w-[140px]">
                  {t('action')}
                </th>
                <th className="p-5 font-bold text-slate-600 dark:text-slate-400 text-sm tracking-tight w-[120px]">
                  {t('criterion')}
                </th>
                <th className="p-5 font-bold text-slate-600 dark:text-slate-400 text-sm tracking-tight">
                  {t('detail')}
                </th>
                <th className="p-5 font-bold text-slate-600 dark:text-slate-400 text-sm tracking-tight w-[80px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-[#12223c]/50 transition-colors">
                    <td className="p-5 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.tarih).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'en' ? 'en-US' : 'tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                        {log.userName || t('system_user')}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        {log.userName ? getLocalizedRole(log.userRole) : '-'}
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getActionBadgeColor(log.islem_tipi)}`}>
                        {t(`action_types.${log.islem_tipi}`) || log.islem_tipi}
                      </span>
                    </td>
                    <td className="p-5">
                      {log.alt_olcut_id ? (
                        <button 
                          onClick={() => router.push(`/olcutler/${log.alt_olcut_id}/uygulama`)}
                          className="font-bold text-indigo-600 dark:text-[#9e7f59] hover:underline cursor-pointer text-sm"
                        >
                          {log.criterionKod || `#${log.alt_olcut_id}`}
                        </button>
                      ) : (
                        <span className="text-slate-400 font-medium text-sm">-</span>
                      )}
                    </td>
                    <td className="p-5 text-slate-700 dark:text-slate-300 font-medium text-sm leading-relaxed max-w-md truncate" title={formatDetail(log)}>
                      {formatDetail(log)}
                    </td>
                    <td className="p-5 text-right">
                      {log.alt_olcut_id && (
                        <button 
                          onClick={() => router.push(`/olcutler/${log.alt_olcut_id}/uygulama`)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e2d4a] rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all cursor-pointer"
                          title={t('go_to_criterion')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 dark:text-slate-500 italic font-semibold text-sm">
                    {t('no_logs')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 bg-white dark:bg-[#0f1e36] border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('pagination_text', { 
              total: filteredLogs.length, 
              start: currentPage * logsPerPage + 1, 
              end: Math.min((currentPage + 1) * logsPerPage, filteredLogs.length) 
            })}
          </span>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e2d4a] disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 px-3">
              {currentPage + 1} / {totalPages}
            </span>
            <button 
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e2d4a] disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
