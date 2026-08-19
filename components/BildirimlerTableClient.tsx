'use client';

import { useState, useEffect } from 'react';
import { Presentation, Activity, Calendar, Info, Hash, Upload, X, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { validateFileSize } from '@/lib/utils';

const getAsamaSlug = (asama: string) => {
  if (!asama) return 'kontrol-etme';
  const lower = asama.toLowerCase();
  const map: Record<string, string> = {
    'kalite_el_kitabi': 'kalite-el-kitabi',
    'planlama': 'planlama',
    'uygulama': 'uygulama',
    'kontrol': 'kontrol-etme',
    'onlem': 'iyilestirme',
    'önlem': 'iyilestirme',
    'olgunluk': 'olgunluk',
    'rapor': 'ozdegerlendirme'
  };
  return map[lower] || lower;
};

export default function BildirimlerTableClient({ initialData, isApprover = false }: { initialData: any[], isApprover?: boolean }) {
  const t = useTranslations('Notifications');
  const [data, setData] = useState(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const channel = supabase
      .channel('public:puko_degerlendirmeleri_table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puko_degerlendirmeleri' }, (payload) => {
        // We do NOT call router.refresh() here because it fetches cached Server Component state
        // and overwrites optimistic UI updates. 
        // If real-time sync is strictly needed, we should manually fetch the updated row here.
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getPukoBadgeColor = (asama: string) => {
    const lower = (asama || '').toLowerCase();
    if (lower.includes('planla')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (lower.includes('uygula')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (lower.includes('kontrol')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (lower.includes('önlem') || lower.includes('onlem')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getStatusBadge = (durum: string) => {
    const lower = (durum || '').toLowerCase();
    if (lower === 'onaylandı' || lower === 'onaylandi') {
      return <span className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 px-3 py-1 rounded-full text-xs font-bold w-24 text-center inline-block">{t('status.approved')}</span>;
    }
    if (lower === 'reddedildi') {
      return <span className="bg-red-50 text-red-700 ring-1 ring-red-600/20 px-3 py-1 rounded-full text-xs font-bold w-24 text-center inline-block">{t('status.rejected')}</span>;
    }
    return <span className="bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 px-3 py-1 rounded-full text-xs font-bold w-24 text-center inline-block">{t('status.pending')}</span>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US');
  };

  const currentData = data || [];

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from('puko_degerlendirmeleri')
        .update({ durum: 'Onaylandı' })
        .eq('id', id);
      if (error) throw error;
      setData(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      alert('Onay sırasında hata: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (id: string) => {
    setRejectReason('');
    setRejectingId(id);
    setIsRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectReason.trim()) { alert('Red nedeni giriniz.'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('puko_degerlendirmeleri')
        .update({ durum: 'Reddedildi', red_nedeni: rejectReason })
        .eq('id', rejectingId);
      if (error) throw error;
      setData(prev => prev.filter(item => item.id !== rejectingId));
      setIsRejectModalOpen(false);
    } catch (err: any) {
      alert('Red işlemi sırasında hata: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRevize = (row: any) => {
    setSelectedRow(row);
    setFile(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleRevizeSubmit = async () => {
    if (!file || !selectedRow) return;
    
    const validation = validateFileSize(file);
    if (!validation.valid) {
      setModalError(validation.error!);
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      // 1. Upload new file
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('kanit_dosyalari')
        .upload(fileName, file);

      if (uploadError) throw new Error(t('modal.upload_error') + ': ' + uploadError.message);

      const { data: urlData } = supabase.storage
        .from('kanit_dosyalari')
        .getPublicUrl(fileName);
        
      const fileUrl = urlData.publicUrl;

      // 2. Update database record
      const { error: dbError } = await supabase
        .from('puko_degerlendirmeleri')
        .update({
          kanit_dosya_url: fileUrl,
          durum: 'Beklemede',
          red_nedeni: null
        })
        .eq('id', selectedRow.id);

      if (dbError) throw new Error(t('modal.update_error') + ': ' + dbError.message);

      // 3. Update local state
      setData(prev => prev.map(item => {
        if (item.id === selectedRow.id) {
          return {
            ...item,
            kanit_dosya_url: fileUrl,
            durum: 'Beklemede',
            red_nedeni: null
          };
        }
        return item;
      }));

      // Close modal
      setIsModalOpen(false);

    } catch (err: any) {
      setModalError(err.message || t('modal.process_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/60">
                <th className="px-6 py-5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-indigo-500" /> {t('table.criterion')}
                  </div>
                </th>
                {/* Phase Column Removed */}
                <th className="px-6 py-5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" /> {t('table.date')}
                  </div>
                </th>
                <th className="px-6 py-5 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
                  {t('table.status')}
                </th>
                <th className="px-6 py-5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Presentation className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">{t('table.no_data')}</p>
                      <p className="text-xs mt-1 text-slate-400 font-medium">{t('table.no_data_desc')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentData.map((row) => (
                  <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors cursor-pointer border-b border-slate-100 last:border-0">
                    <td className="px-6 py-5">
                      <div 
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => router.push(`/olcutler/${row.alt_olcut_id}/ozdegerlendirme`)}
                      >
                        <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          {row.alt_olcutler?.kod || '-'}
                        </span>
                        <div className="text-sm font-extrabold text-slate-800 max-w-[300px] truncate group-hover:text-indigo-600 transition-colors" title={getLocalizedField(row.alt_olcutler, 'olcut_adi', locale)}>
                          {getLocalizedField(row.alt_olcutler, 'olcut_adi', locale) || t('Assignments.sidebar.anonymous_user')}
                        </div>
                      </div>
                    </td>
                    {/* Phase Column Removed */}
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-500">
                        {formatDate(row.olusturulma_tarihi || row.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      {getStatusBadge(row.durum)}
                    </td>
                    <td className="px-6 py-4">
                      {isApprover ? (
                        // Onaylayıcı (Admin veya Koordinatör): Onayla / Reddet butonları
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(row.id)}
                            disabled={actionLoadingId === row.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition-all disabled:opacity-50"
                          >
                            {actionLoadingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Onayla
                          </button>
                          <button
                            onClick={() => openRejectModal(row.id)}
                            disabled={actionLoadingId === row.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-all disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> Reddet
                          </button>
                        </div>
                      ) : (row.durum || '').toLowerCase() === 'reddedildi' ? (
                        <div className="flex flex-col gap-3">
                          {row.red_nedeni && (
                            <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-100">
                              <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-red-700 leading-relaxed font-medium">
                                {row.red_nedeni}
                              </p>
                            </div>
                          )}
                          <div>
                            <button
                              onClick={() => handleOpenRevize(row)}
                              className="text-xs font-bold px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 active:scale-95"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              {t('actions.revise')}
                            </button>
                          </div>
                        </div>
                      ) : (row.durum || '').toLowerCase().includes('onay') ? (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Süreç Tamamlandı
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">{t('actions.no_action_needed')}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revize Modal */ }
      {isModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
                  <Upload className="w-5 h-5" />
                </div>
                {t('modal.title')}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 bg-orange-50 border border-orange-200 p-3 rounded-xl text-sm text-orange-800">
                <p className="font-semibold mb-1">{t('modal.rejected_criterion')}: {selectedRow.alt_olcutler?.kod}</p>
                <p className="text-xs opacity-90">{selectedRow.red_nedeni}</p>
              </div>

              {modalError && (
                <div className="mb-4 p-3 rounded-xl text-sm font-medium border bg-red-50 text-red-700 border-red-200">
                  {modalError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  {t('modal.upload_new_evidence')}
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-blue-400 transition-colors bg-slate-50">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label htmlFor="file-upload-revize" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-2 py-1 shadow-sm border border-slate-200">
                        <span>{t('modal.select_file')}</span>
                        <input id="file-upload-revize" name="file-upload-revize" type="file" className="sr-only" onChange={(e) => {
                          const selected = e.target.files?.[0] || null;
                          if (selected) {
                            const v = validateFileSize(selected);
                            if (!v.valid) {
                              setModalError(v.error!);
                              setFile(null);
                              e.target.value = '';
                              return;
                            }
                          }
                          setModalError(null);
                          setFile(selected);
                        }} />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {file ? <span className="font-semibold text-blue-600">{file.name}</span> : t('modal.file_types')}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">{t('modal.info_text')}</p>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRevizeSubmit}
                  disabled={isSubmitting || !file}
                  className="flex justify-center items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 w-full"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? t('modal.submitting') : t('modal.submit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Koordinatör/Admin Red Modalı */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <X className="w-5 h-5 text-red-500" /> Kaydı Reddet
              </h3>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">Bu PUKÖ değerlendirmesini reddetmek üzeresiniz. Red nedenini giriniz.</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Örn: Yüklenen kanıt eksik veya kriterle uyumsuz..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm resize-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={isSubmitting || !rejectReason.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Onayla &amp; Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
