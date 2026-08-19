'use client';

import { useState } from 'react';
import { ExternalLink, Calendar, Presentation, Activity, Building, TrendingUp, Hash, Check, X, Info, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

type RecordType = Record<string, any>;

export default function DashboardTableClient({ initialData, userRole }: { initialData: RecordType[], userRole: string }) {
  const [data, setData] = useState<RecordType[]>(initialData);
  const locale = useLocale();
  
  // Modal States
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const getPukoBadgeColor = (asama: string) => {
    const lower = (asama || '').toLowerCase();
    if (lower.includes('planla')) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
    if (lower.includes('uygula')) return 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20';
    if (lower.includes('kontrol')) return 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20';
    if (lower.includes('önlem') || lower.includes('onlem')) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
    return 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/20';
  };

  const getStatusIndicator = (durum: string) => {
    const lower = (durum || '').toLowerCase();
    if (lower === 'onaylandı' || lower === 'onaylandi') return 'bg-green-500 shadow-green-500/40 text-green-700';
    if (lower === 'reddedildi') return 'bg-red-500 shadow-red-500/40 text-red-700';
    return 'bg-amber-400 shadow-amber-400/40 text-amber-700'; // Beklemede
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  };

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from('puko_degerlendirmeleri')
        .update({ durum: 'Onaylandı' })
        .eq('id', id);

      if (error) throw error;
      
      setData((prev) => prev.map((item) => item.id === id ? { ...item, durum: 'Onaylandı' } : item));
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Onay işlemi sırasında bir hata oluştu: ${error.message}`);
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
    if (!rejectingId || !rejectReason.trim()) {
      alert("Lütfen red nedeni giriniz.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('puko_degerlendirmeleri')
        .update({ 
          durum: 'Reddedildi',
          red_nedeni: rejectReason
        })
        .eq('id', rejectingId);

      if (error) throw error;
      
      setData((prev) => prev.map((item) => item.id === rejectingId ? { ...item, durum: 'Reddedildi', red_nedeni: rejectReason } : item));
      setIsRejectModalOpen(false);
      setRejectingId(null);
      setRejectReason('');
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Reddetme işlemi sırasında bir hata oluştu: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isYonetici = userRole.toLowerCase().includes('yonetici') || userRole.toLowerCase().includes('yönetici') || userRole.toLowerCase().includes('admin');

  return (
    <>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">Durum</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4" /> Kriter Kodu
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" /> Birim
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Aşama
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  <div className="flex items-center justify-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Olgunluk
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Tarih
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Presentation className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-sm font-medium text-slate-500">Kayıtlı veri bulunamadı</p>
                      <p className="text-xs mt-1 text-slate-400">Veritabanında kayıt bulunmuyor.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const durumLabel = row.durum || 'Beklemede';
                  
                  return (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    
                    {/* Durum Göstergesi */}
                    <td className="px-6 py-4 text-center align-middle">
                      <div className="relative group flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full shadow-sm ${getStatusIndicator(durumLabel)}`} />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap z-10 pointer-events-none">
                          {durumLabel}
                        </div>
                      </div>
                    </td>

                    {/* Kriter Kodu Sütunu */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {row.alt_olcutler?.kod || '-'}
                        </span>
                        <div className="text-sm font-medium text-slate-600 max-w-[200px] truncate" title={getLocalizedField(row.alt_olcutler, 'olcut_adi', locale)}>
                          {getLocalizedField(row.alt_olcutler, 'olcut_adi', locale) || 'Bilinmeyen Kriter'}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 truncate max-w-[250px]" title={row.aciklama}>
                        {row.aciklama || 'Açıklama yok'}
                      </div>
                    </td>
                    
                    {/* Birim Sütunu */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">
                        {row.birimler?.birim_adi || `Birim ID: ${row.birim_id || '-'}`}
                      </span>
                    </td>
                    
                    {/* Aşama Sütunu */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold capitalize ${getPukoBadgeColor(row.puko_asamasi)}`}>
                        {row.puko_asamasi || '-'}
                      </span>
                    </td>
                    
                    {/* Olgunluk Sütunu */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-sm border border-blue-100">
                        {row.olgunluk_seviyesi || '-'}
                      </div>
                    </td>

                    {/* Tarih Sütunu */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-500">
                        {formatDate(row.olusturulma_tarihi)}
                      </span>
                    </td>
                    
                    {/* İşlemler Sütunu */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        
                        {/* Red Nedeni Info Icon */}
                        {durumLabel.toLowerCase() === 'reddedildi' && row.red_nedeni && (
                          <div className="relative group flex items-center justify-center mr-1 cursor-help">
                            <Info className="w-5 h-5 text-red-500 hover:text-red-600 transition-colors" />
                            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block p-3 bg-slate-800 text-white text-xs rounded-xl shadow-lg w-64 z-10 text-left border border-slate-700 pointer-events-none">
                              <p className="font-semibold mb-1 text-red-300">Red Nedeni:</p>
                              <p className="leading-relaxed">{row.red_nedeni}</p>
                            </div>
                          </div>
                        )}

                        {row.kanit_dosya_url && (
                          <a 
                            href={row.kanit_dosya_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-sm focus:outline-none"
                            title="Kanıtı Görüntüle"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Kanıt</span>
                          </a>
                        )}
                        
                        {isYonetici && (
                          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
                            <button
                              onClick={() => handleApprove(row.id)}
                              disabled={actionLoadingId === row.id}
                              className="inline-flex items-center justify-center p-1.5 bg-green-50 text-green-600 font-bold hover:bg-green-100 hover:text-green-700 border border-green-200 rounded-lg transition-colors shadow-sm focus:outline-none disabled:opacity-50"
                              title="Onayla"
                            >
                              {actionLoadingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openRejectModal(row.id)}
                              disabled={actionLoadingId === row.id}
                              className="inline-flex items-center justify-center p-1.5 bg-red-50 text-red-600 font-bold hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-lg transition-colors shadow-sm focus:outline-none disabled:opacity-50"
                              title="Reddet"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <X className="w-5 h-5 text-red-500" /> Kaydı Reddet
              </h3>
              <button 
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                Bu PUKÖ değerlendirmesini reddetmek üzeresiniz. Lütfen personelin eksikliğini anlaması için açıklayıcı bir red nedeni giriniz.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Red Nedeni Modülü (<span className="text-red-500">*</span>)</label>
                <textarea 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Örn: Yüklenen kanıt dosyası eksik veya kriterle uyumsuz..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm resize-none"
                />
              </div>
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
                Onayla & Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
