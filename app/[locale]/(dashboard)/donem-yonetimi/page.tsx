'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  X,
  Save,
  Lock,
  Unlock
} from 'lucide-react';
import { logAction } from '@/lib/logger';
import { useTranslations } from 'next-intl';

interface Period {
  id: string;
  donem_adi: string;
  is_active: boolean;
  is_sealed?: boolean;
  created_at?: string;
}

export default function PeriodManagementPage() {
  const t = useTranslations('PeriodManagement');
  const commonT = useTranslations('Common');
  
  const [periods, setPeriods] = useState<Period[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [formData, setFormData] = useState({
    donem_adi: '',
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPeriods = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
      const role = profile?.rol?.toLowerCase() || '';
      const isUserAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
      const isUserObserver = role.includes('gozlemci') || role.includes('gözlemci');
      setIsAdmin(isUserAdmin || isUserObserver);
      setIsObserver(isUserObserver);

      if (isUserAdmin || isUserObserver) {
        const { data } = await supabase
          .from('donemler')
          .select('*')
          .order('donem_adi', { ascending: false });
        
        if (data) setPeriods(data);
      }
    } catch (error) {
      console.error("Dönemler yüklenemedi:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleOpenModal = (period: Period | null = null) => {
    setEditingPeriod(period);
    if (period) {
      setFormData({
        donem_adi: period.donem_adi,
        is_active: period.is_active
      });
    } else {
      setFormData({
        donem_adi: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isObserver) return;
    if (!formData.donem_adi.trim()) return;

    setIsSubmitting(true);
    try {
      // Güvenlik Yaması: Aynı anda birden fazla aktif dönem olmasını engelle
      if (formData.is_active) {
        const { error: activeErr } = await supabase
          .from('donemler')
          .update({ is_active: false })
          .eq('is_active', true);
        if (activeErr) throw activeErr;
      }

      if (editingPeriod) {
        const { error } = await supabase
          .from('donemler')
          .update({
            donem_adi: formData.donem_adi,
            is_active: formData.is_active
          })
          .eq('id', editingPeriod.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('donemler')
          .insert({
            donem_adi: formData.donem_adi,
            is_active: formData.is_active
          });
        
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchPeriods();
      // Refresh the page or header to update period selector
      window.location.reload(); 
    } catch (error: any) {
      alert(t('messages.save_error') + ": " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSealPeriod = async (period: Period) => {
    if (isObserver) return;
    if (!confirm(`${period.donem_adi} dönemini mühürlemek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm veriler salt okunur (read-only) olacaktır.`)) return;

    try {
      setIsLoading(true);
      
      // 1. Dönemi mühürle
      const { error } = await supabase
        .from('donemler')
        .update({ is_sealed: true, is_active: false })
        .eq('id', period.id);
      
      if (error) throw error;

      // 2. Audit Log
      await logAction({
        supabase,
        islemTipi: 'SEAL',
        tabloAdi: 'donemler',
        kayitId: period.id,
        yeniVeri: { is_sealed: true }
      });

      // 3. Otomatik Yeni Dönem Şablonu (2026 -> 2027 gibi)
      const currentYear = parseInt(period.donem_adi);
      if (!isNaN(currentYear)) {
        const nextYear = (currentYear + 1).toString();
        const { data: existingNext } = await supabase.from('donemler').select('id').eq('donem_adi', nextYear).maybeSingle();
        
        if (!existingNext) {
          await supabase.from('donemler').insert({
            donem_adi: nextYear,
            is_active: true
          });
        }
      }

      alert("Dönem başarıyla mühürlendi ve yeni dönem şablonu hazırlandı.");
      fetchPeriods();
      window.location.reload();
    } catch (error: any) {
      alert("Mühürleme hatası: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isObserver) return;
    if (!confirm(t('messages.delete_confirm'))) return;
    try {
      const { error } = await supabase.from('donemler').delete().eq('id', id);
      if (error) throw error;
      fetchPeriods();
      window.location.reload();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (isLoading) {
    return <div className="h-[calc(100vh-100px)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-8">
        <div className="bg-red-50 p-10 rounded-3xl border border-red-200 text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-700 mb-2">Yetkisiz Erişim</h2>
          <p className="text-red-500 text-sm">Bu sayfayı sadece sistem yöneticileri görüntüleyebilir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
            <Calendar className="w-8 h-8 text-indigo-600" />
            {t('title')}
          </h1>
          <p className="text-slate-500 mt-2 text-sm">{t('description')}</p>
        </div>
        {!isObserver && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('add_new')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.name')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.status')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periods.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-20 text-center text-slate-400">
                  Henüz bir dönem eklenmemiş.
                </td>
              </tr>
            ) : (
              periods.map((period) => (
                <tr key={period.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-700 text-lg">{period.donem_adi}</span>
                  </td>
                  <td className="px-6 py-4">
                    {period.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold ring-1 ring-emerald-600/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('status.active')}
                      </span>
                    ) : period.is_sealed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-full text-xs font-bold ring-1 ring-slate-800">
                        <Lock className="w-3.5 h-3.5" />
                        MÜHÜRLÜ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-xs font-bold ring-1 ring-slate-600/20">
                        <XCircle className="w-3.5 h-3.5" />
                        {t('status.passive')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {!period.is_sealed && (
                      <>
                        {!isObserver ? (
                          <>
                            <button 
                              onClick={() => handleSealPeriod(period)}
                              className="p-2 text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                              title="Dönemi Mühürle (Kalıcı Kilit)"
                            >
                              <Lock className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleOpenModal(period)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(period.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 italic">Salt Okunur</span>
                        )}
                      </>
                    )}
                    {period.is_sealed && (
                      <span className="text-xs font-bold text-slate-400 italic">Arşivlenmiş Dönem</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                {t('modal.title')}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{t('modal.name_label')}</label>
                <input 
                  type="text"
                  required
                  value={formData.donem_adi}
                  onChange={(e) => setFormData({...formData, donem_adi: e.target.value})}
                  placeholder={t('modal.name_placeholder')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-bold text-slate-800">{t('modal.is_active_label')}</label>
                    <p className="text-xs text-slate-500 mt-1">{t('modal.is_active_desc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, is_active: !formData.is_active})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.is_active ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex justify-center items-center gap-2 px-6 py-4 text-white bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSubmitting ? commonT('loading') : commonT('save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {commonT('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
