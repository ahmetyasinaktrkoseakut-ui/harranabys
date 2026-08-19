'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import DOMPurify from 'dompurify';
import { Loader2, CheckCircle2, ClipboardList, Send } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { logSystemAction } from '@/lib/logger';

interface PublicAnketClientProps {
  params: Promise<{ id: string }>;
}

export default function PublicAnketClient({ params }: PublicAnketClientProps) {
  const resolvedParams = use(params);
  const t = useTranslations('Surveys.public');
  const locale = useLocale();
  
  const [anket, setAnket] = useState<any>(null);
  const [cevaplar, setCevaplar] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnket() {
      try {
        setIsLoading(true);
        // Supabase id might be a number or UUID depending on the user's schema
        // We will try to fetch it as is.
        const { data, error } = await supabase
          .from('anketler')
          .select('*')
          .eq('id', resolvedParams.id)
          .maybeSingle();

        if (error) throw error;
        setAnket(data);
        
        // Initialize cevaplar
        if (data && data.sorular) {
          const initCevaplar: Record<string, any> = {};
          data.sorular.forEach((s: any) => {
            if (s.tip === 'coklu_secim') initCevaplar[s.id] = [];
            else if (s.tip === 'likert') initCevaplar[s.id] = {};
            else if (s.tip === 'coklu_metin') {
              const bMap: Record<string, string> = {};
              s.birimler?.forEach((b: string) => bMap[b] = '');
              initCevaplar[s.id] = bMap;
            }
            else initCevaplar[s.id] = '';
          });
          setCevaplar(initCevaplar);
        }
      } catch (e: any) {
        console.error(e);
        setError('Anket bulunamadı veya bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnket();
  }, [resolvedParams.id]);

  const handleCevapChange = (soruId: string, value: any) => {
    setCevaplar(prev => ({ ...prev, [soruId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basit Validasyon (Boş zorunlu alan kontrolü vb eklenebilir, şimdilik geçiyoruz)
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('anket_cevaplari').insert({
        anket_id: anket.id,
        cevaplar: cevaplar
      });

      if (error) throw error;
      
      
      // Anket gönderim logunu at (asenkron, hatayı yutacak)
      await logSystemAction({
        supabase,
        islemTipi: 'INSERT',
        tabloAdi: 'anket_cevaplari',
        kayitId: anket.id,
        yeniVeri: cevaplar,
        detay: `Public Anket Cevaplandı: ${anket.baslik}`
      });

      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert(`Yanıt gönderilirken hata oluştu: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;
  }

  if (error || !anket) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md text-center max-w-md w-full border-t-8 border-t-red-500">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Hata</h2>
          <p className="text-slate-600">{error || 'Anket bulunamadı.'}</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-2xl shadow-md text-center max-w-md w-full border-t-8 border-t-emerald-500 animate-in zoom-in-95 duration-500">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('success_title')}</h2>
          <p className="text-slate-600 mb-6">{t('success_desc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Form Başlığı */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6 border-t-8 border-t-purple-600">
          <div className="p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">{anket.baslik}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 border-b border-slate-100 pb-4">
              <ClipboardList className="w-4 h-4" />
              <span>{t('title')}</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {anket.aciklama || t('desc')}
            </p>
          </div>
        </div>

        {/* Form İçeriği */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {anket.sorular?.map((soru: any, index: number) => (
            <div key={soru.id} className={`bg-white p-8 rounded-2xl shadow-sm border transition-all ${soru.tip === 'bilgi_kutusu' ? 'border-amber-200 bg-amber-50/20' : soru.tip === 'bolum_basligi' ? 'border-none bg-gradient-to-r from-purple-50 to-blue-50 shadow-inner' : 'border-slate-200 focus-within:shadow-md focus-within:border-purple-300'}`}>
              {soru.tip === 'bilgi_kutusu' ? (
                <div className="prose prose-slate max-w-none">
                  <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">{soru.soru}</h3>
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(soru.aciklama || '') }} />
                </div>
              ) : soru.tip === 'bolum_basligi' ? (
                <div className="py-4 border-b-2 border-purple-500 pb-4">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{soru.soru}</h2>
                  {soru.aciklama && <p className="text-sm text-slate-500 mt-2 font-medium">{soru.aciklama}</p>}
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-slate-800 mb-4">
                    <span className="text-purple-600 mr-2 font-bold">{index + 1}.</span> 
                    {soru.soru} {soru.zorunlu && <span className="text-red-500">*</span>}
                  </h3>
                  
                  <div className="pl-0 md:pl-6">
                    {/* Kısa Yanıt */}
                    {soru.tip === 'kisa_yanit' && (
                      <input 
                        type="text"
                        required={soru.zorunlu}
                        value={cevaplar[soru.id] || ''}
                        onChange={(e) => handleCevapChange(soru.id, e.target.value)}
                        placeholder="Yanıtınız"
                        className="w-full text-base bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none py-2 transition-colors placeholder:text-slate-400"
                      />
                    )}

                    {/* Uzun Yanıt */}
                    {soru.tip === 'uzun_yanit' && (
                      <textarea 
                        required={soru.zorunlu}
                        rows={4}
                        value={cevaplar[soru.id] || ''}
                        onChange={(e) => handleCevapChange(soru.id, e.target.value)}
                        placeholder="Yanıtınız..."
                        className="w-full text-base bg-slate-50 border border-slate-200 rounded-xl p-4 focus:border-purple-600 focus:outline-none transition-colors"
                      />
                    )}

                    {/* Çoktan Seçmeli (Radio) */}
                    {soru.tip === 'coktan_secmeli' && (
                      <div className="space-y-3">
                        {soru.secenekler?.map((secenek: any) => (
                          <label key={secenek.id} className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                            <input 
                              type="radio" 
                              name={`soru_${soru.id}`}
                              required={soru.zorunlu}
                              value={secenek.id}
                              checked={cevaplar[soru.id] === secenek.id}
                              onChange={() => handleCevapChange(soru.id, secenek.id)}
                              className="w-5 h-5 text-purple-600 bg-slate-100 border-slate-300 focus:ring-purple-500 focus:ring-2"
                            />
                            <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{secenek.metin}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Çoklu Seçim (Checkbox) */}
                    {soru.tip === 'coklu_secim' && (
                      <div className="space-y-3">
                        {soru.secenekler?.map((secenek: any) => (
                          <label key={secenek.id} className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                            <input 
                              type="checkbox" 
                              checked={(cevaplar[soru.id] || []).includes(secenek.id)}
                              onChange={(e) => {
                                const current = cevaplar[soru.id] || [];
                                const next = e.target.checked ? [...current, secenek.id] : current.filter((id: string) => id !== secenek.id);
                                handleCevapChange(soru.id, next);
                              }}
                              className="w-5 h-5 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                            />
                            <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{secenek.metin}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Açılır Menü */}
                    {soru.tip === 'acilir_menu' && (
                      <select 
                        required={soru.zorunlu}
                        value={cevaplar[soru.id] || ''}
                        onChange={(e) => handleCevapChange(soru.id, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-700 focus:border-purple-600 focus:outline-none transition-colors"
                      >
                        <option value="">Lütfen birini seçiniz...</option>
                        {soru.secenekler?.map((s: any) => <option key={s.id} value={s.id}>{s.metin}</option>)}
                      </select>
                    )}

                    {/* Likert Ölçek */}
                    {soru.tip === 'likert' && (
                      <div className="overflow-x-auto -mx-4 md:mx-0 border border-slate-200 rounded-xl">
                        <table className="w-full border-collapse min-w-[600px] text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest w-1/3 min-w-[250px] border-r border-slate-200">Sorular</th>
                              {(soru.secenekler && soru.secenekler.length > 0 ? soru.secenekler : Array.from({ length: soru.likert_olcek || 5 }).map((_, i) => ({ id: `col${i}`, metin: (i + 1).toString() }))).map((sec: any) => (
                                <th key={sec.id} className="p-4 text-center text-xs font-black text-slate-500 uppercase border-r border-slate-200 last:border-0">
                                  {sec.metin}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(soru.birimler && soru.birimler.length > 0 ? soru.birimler : ['Değerlendirme İfadesi']).map((ifade: string, iIdx: number) => {
                              const safeRowId = `row_${iIdx}`;
                              return (
                                <tr key={safeRowId} className="hover:bg-purple-50/30 transition-colors border-b border-slate-100 last:border-0">
                                  <td className="p-4 text-sm font-medium text-slate-700 border-r border-slate-200">{ifade}</td>
                                  {(soru.secenekler && soru.secenekler.length > 0 ? soru.secenekler : Array.from({ length: soru.likert_olcek || 5 }).map((_, i) => ({ id: `col${i}`, metin: (i + 1).toString() }))).map((sec: any) => {
                                    const val = sec.id || sec.metin;
                                    const currentVal = (cevaplar[soru.id] || {})[safeRowId];
                                    return (
                                      <td key={sec.id} className="p-4 text-center border-r border-slate-200 last:border-0">
                                        <input 
                                          type="radio"
                                          required={soru.zorunlu}
                                          name={`likert_${soru.id}_${safeRowId}`}
                                          checked={currentVal === val}
                                          onChange={() => {
                                            const next = { ...(cevaplar[soru.id] || {}), [safeRowId]: val };
                                            handleCevapChange(soru.id, next);
                                          }}
                                          className="w-5 h-5 text-purple-600 focus:ring-purple-500"
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Çoklu Metin */}
                    {soru.tip === 'coklu_metin' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {soru.birimler?.map((birim: string) => (
                          <div key={birim} className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider">{birim}</label>
                            <textarea 
                              required={soru.zorunlu}
                              rows={3}
                              value={(cevaplar[soru.id] || {})[birim] || ''}
                              onChange={(e) => {
                                const next = { ...(cevaplar[soru.id] || {}), [birim]: e.target.value };
                                handleCevapChange(soru.id, next);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:border-purple-600 focus:outline-none transition-colors"
                              placeholder="Detaylı yanıtınız..."
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          <div className="pt-4 flex items-center justify-between">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {isSubmitting ? t('submitting') : t('submit')}
            </button>
            <div className="text-xs text-slate-400 text-right">
              {t('footer')}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
