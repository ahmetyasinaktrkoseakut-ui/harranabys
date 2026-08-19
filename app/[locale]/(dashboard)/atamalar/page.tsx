'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { UserCheck, Search, Users, AlertCircle, Loader2, Save, CheckCircle2, FileText, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

export default function AtamalarPage() {
  const t = useTranslations('Assignments');
  const tCommon = useTranslations('Common');
  const { selectedPeriod } = usePeriod();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hocalar, setHocalar] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [anaBasliklar, setAnaBasliklar] = useState<any[]>([]);
  const [allAtamalar, setAllAtamalar] = useState<any[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  
  const [selectedHoca, setSelectedHoca] = useState<string | null>(null);
  const [selectedOlcutIds, setSelectedOlcutIds] = useState<number[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const locale = useLocale();

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const fetchInitialData = useCallback(async () => {
    if (!selectedPeriod) return;
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = profile?.rol?.toLowerCase() || '';
        setIsObserver(role.includes('gözlemci') || role.includes('gozlemci'));
      }

      // Hocaları getir (Birim Sorumluları ve Bekleme Durumundakiler)
      const { data: profillerData, error: profillerError } = await supabase
        .from('profiller')
        .select('*')
        .or('rol.ilike.%Birim%Sorumlusu%,rol.eq.Beklemede');
      
      if (profillerError) throw profillerError;
      
      // Tüm alt ölçütleri getir
      const { data: olcutlerData, error: olcutlerError } = await supabase
        .from('alt_olcutler')
        .select('*')
        .order('id', { ascending: true });
        
      if (olcutlerError) throw olcutlerError;

      // Ana başlıkları getir
      const { data: baslikData } = await supabase.from('ana_basliklar').select('*');

      // Tüm atamaları getir (Bu dönem için)
      const { data: atamalarData } = await supabase
        .from('kullanici_olcut_atamalari')
        .select('*')
        .eq('donem_id', selectedPeriod.id);

      setHocalar(profillerData || []);
      setOlcutler(olcutlerData || []);
      setAnaBasliklar(baslikData || []);
      setAllAtamalar(atamalarData || []);
    } catch (error: any) {
      console.error("Veri çekme hatası:", error);
      setMessage({ type: 'error', text: t('messages.fetch_error') });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, t]);

  const fetchHocaAtamalari = useCallback(async (userId: string) => {
    if (!selectedPeriod) {
      setSelectedOlcutIds([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('kullanici_olcut_atamalari')
        .select('alt_olcut_id')
        .eq('user_id', userId)
        .eq('donem_id', selectedPeriod.id);

      if (error) throw error;
      
      if (data) {
        setSelectedOlcutIds(data.map(item => item.alt_olcut_id));
      } else {
        setSelectedOlcutIds([]);
      }
    } catch (error: any) {
      console.error("Atama çekme hatası:", error);
      setMessage({ type: 'error', text: t('messages.atama_fetch_error') });
    }
  }, [selectedPeriod, t]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const syncData = async () => {
      if (selectedHoca) {
        await fetchHocaAtamalari(selectedHoca);
      } else {
        setSelectedOlcutIds(prev => prev.length > 0 ? [] : prev);
      }
    };
    syncData();
  }, [selectedHoca, fetchHocaAtamalari]);

  const handleToggleOlcut = (id: number) => {
    setSelectedOlcutIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleDateChange = (id: number, field: 'erisim_baslangic' | 'erisim_bitis', value: string) => {
    setOlcutler(prev => prev.map(o => 
      o.id === id ? { ...o, [field]: value || null } : o
    ));
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      // Sadece başka birine atanmamış olanları seç
      const availableOlcutIds = olcutler
        .filter(o => !allAtamalar.some(a => a.alt_olcut_id === o.id && a.user_id !== selectedHoca))
        .map(o => o.id);
      setSelectedOlcutIds(availableOlcutIds);
    } else {
      setSelectedOlcutIds([]);
    }
  };

  const handleSave = async () => {
    if (!selectedHoca) return;
    if (!selectedPeriod) {
      alert("Aktif dönem seçili değil.");
      return;
    }
    
    setIsSaving(true);
    setMessage(null);

    try {
      // rpc_v3_assign_all_olcutler kullanarak atomik işlem yapıyoruz.
      // Bu fonksiyon önce siler, sonra array içindekileri ekler.
      const { error } = await supabase.rpc('rpc_v3_assign_all_olcutler', {
        p_user_id: selectedHoca,
        p_donem_id: selectedPeriod.id,
        p_olcut_ids: selectedOlcutIds // Frontend'de number[] olarak tutuluyor
      });

      if (error) throw error;

      // Eğer kullanıcının rolü "Beklemede" ise ve en az 1 ölçüt atandıysa "BirimSorumlusu" yap
      const hoca = hocalar.find(h => h.id === selectedHoca);
      if (hoca && hoca.rol === 'Beklemede' && selectedOlcutIds.length > 0) {
        const { error: roleError } = await supabase
          .from('profiller')
          .update({ rol: 'BirimSorumlusu' })
          .eq('id', selectedHoca);
        if (roleError) throw roleError;
        
        setHocalar(prev => prev.map(h => h.id === selectedHoca ? { ...h, rol: 'BirimSorumlusu' } : h));
      }

      // 3. Alt ölçütlerin erişim tarihlerini güncelle
      if (olcutler.length > 0) {
        const { error: dateError } = await supabase
          .from('alt_olcutler')
          .upsert(olcutler);
        
        if (dateError) throw dateError;
      }

      setMessage({ type: 'success', text: t('messages.save_success') });

      // Atamaları yenile
      const { data: updatedAtamalar } = await supabase
        .from('kullanici_olcut_atamalari')
        .select('*')
        .eq('donem_id', selectedPeriod?.id);
      if (updatedAtamalar) setAllAtamalar(updatedAtamalar);
      
      // Mesajı 3 saniye sonra kaldır
      setTimeout(() => {
        setMessage(null);
      }, 3000);
      
    } catch (error: any) {
      console.error("Kaydetme hatası:", error);
      setMessage({ type: 'error', text: t('messages.save_error') + ': ' + error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredHocalar = hocalar.filter(h => 
    h.ad_soyad?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.unvan?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 border-b border-slate-200 pb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-indigo-600" />
            {t('title')}
          </h2>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-2xl">
            {t('description')}
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {message.type === 'success' ? tCommon('success') : tCommon('error')}
            </h3>
            <p className="text-sm mt-1 opacity-90">{message.text}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 items-start h-[calc(100vh-250px)] min-h-[600px]">
        {/* Sol Taraf: Hocalar Listesi */}
        <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Users className="w-5 h-5 text-indigo-500" />
              {t('sidebar.title')} ({filteredHocalar.length})
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={t('sidebar.search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-sm">{t('sidebar.loading')}</span>
              </div>
            ) : filteredHocalar.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                {t('sidebar.no_user')}
              </div>
            ) : (
              filteredHocalar.map((hoca) => (
                <button
                  key={hoca.id}
                  onClick={() => setSelectedHoca(hoca.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all border ${
                    selectedHoca === hoca.id 
                      ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/50 shadow-sm' 
                      : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      selectedHoca === hoca.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {hoca.ad_soyad?.charAt(0) || hoca.email?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className={`font-semibold text-sm truncate ${selectedHoca === hoca.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {hoca.unvan ? `${hoca.unvan} ` : ''}{hoca.ad_soyad || t('sidebar.anonymous_user')}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{hoca.email}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Sağ Taraf: Ölçüt Atama İşlemleri */}
        <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full relative">
          {!selectedHoca ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/30">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600">{t('main.select_user_title')}</h3>
              <p className="text-sm mt-2 max-w-md">{t('main.select_user_desc')}</p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {t('main.assignments_for', { name: `${hocalar.find(h => h.id === selectedHoca)?.unvan || ''} ${hocalar.find(h => h.id === selectedHoca)?.ad_soyad || ''}` })}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('main.selected_count', { count: selectedOlcutIds.length, total: olcutler.length })}
                  </p>
                </div>
                {!isObserver && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleSelectAll(true)}
                      className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                      {t('main.select_all')}
                    </button>
                    <button 
                      onClick={() => handleSelectAll(false)}
                      className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                      {t('main.deselect_all')}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      olcutler.reduce((acc, olcut) => {
                        const groupKey = olcut.kod ? olcut.kod.split('.')[0] : t('main.other_group');
                        if (!acc[groupKey]) acc[groupKey] = [];
                        acc[groupKey].push(olcut);
                        return acc;
                      }, {} as Record<string, any[]>)
                    )
                    .sort(([k1], [k2]) => k1.localeCompare(k2))
                    .map(([harf, items]) => {
                      const baslikObj = anaBasliklar.find(b => b.kod === harf || (b.baslik_adi && b.baslik_adi.startsWith(harf + '.')));
                      const displayTitle = getLocalizedField(baslikObj, 'baslik_adi', locale) || t('main.group_title', { harf });
                      const isOpen = openGroups[harf] || false;

                      return (
                        <div key={harf} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                          <button 
                            onClick={() => toggleGroup(harf)}
                            className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-sm font-bold">
                                {harf}
                              </div>
                              <h4 className="font-bold text-slate-800 text-sm">{displayTitle}</h4>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                          </button>
                          
                          {isOpen && (
                            <div className="p-4 border-t border-slate-100 bg-white grid grid-cols-1 gap-2">
                              {(items as any[]).map((olcut: any) => {
                                const isAssignedToOther = allAtamalar.some(a => a.alt_olcut_id === olcut.id && a.user_id !== selectedHoca);
                                const isSelected = selectedOlcutIds.includes(olcut.id);
                                return (
                                  <div 
                                    key={olcut.id} 
                                    className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
                                      isAssignedToOther ? 'bg-slate-50 border-slate-200 opacity-80' :
                                      isSelected 
                                        ? 'bg-indigo-50/50 border-indigo-200' 
                                        : 'bg-white border-slate-100 hover:border-indigo-200'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="pt-0.5">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={isAssignedToOther || isObserver}
                                          onChange={() => {
                                            if (!isAssignedToOther && !isObserver) handleToggleOlcut(olcut.id);
                                          }}
                                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                                        />
                                      </div>
                                      <div className="flex-1 flex justify-between items-start gap-2">
                                        <div className={`text-xs font-semibold ${isSelected && !isAssignedToOther ? 'text-indigo-900' : 'text-slate-700'}`}>
                                          {[olcut.kod, getLocalizedField(olcut, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${olcut.id}`}
                                        </div>
                                        {isAssignedToOther && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-500 rounded flex-shrink-0">
                                            {t('main.assigned_badge')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Tarih Seçiciler */}
                                    <div className="flex items-center gap-4 pl-7 border-t border-slate-100 pt-3">
                                      <div className="flex-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('access_start') || 'Erişim Başlangıç'}</label>
                                        <input 
                                          type="datetime-local"
                                          value={olcut.erisim_baslangic ? new Date(new Date(olcut.erisim_baslangic).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                          disabled={isObserver}
                                          onChange={(e) => handleDateChange(olcut.id, 'erisim_baslangic', e.target.value)}
                                          className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('access_end') || 'Erişim Bitiş'}</label>
                                        <input 
                                          type="datetime-local"
                                          value={olcut.erisim_bitis ? new Date(new Date(olcut.erisim_bitis).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                          disabled={isObserver}
                                          onChange={(e) => handleDateChange(olcut.id, 'erisim_bitis', e.target.value)}
                                          className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving || (selectedPeriod ? !selectedPeriod.is_active : false) || isObserver}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-70 active:scale-95"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('main.save_changes')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
