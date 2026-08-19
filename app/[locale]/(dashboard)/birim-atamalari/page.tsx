'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Users, AlertCircle, Loader2, Save, CheckCircle2, Search } from 'lucide-react';
import { usePeriod } from '@/contexts/PeriodContext';

export default function BirimAtamalariPage() {
  const { selectedPeriod } = usePeriod();
  
  const [coordinatorTopic, setCoordinatorTopic] = useState<string | null>(null);
  const [hocalar, setHocalar] = useState<any[]>([]);
  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [altOlcutler, setAltOlcutler] = useState<any[]>([]);
  const [allAtamalar, setAllAtamalar] = useState<any[]>([]);
  
  const [selectedHoca, setSelectedHoca] = useState<string | null>(null);
  const [selectedOlcutIds, setSelectedOlcutIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedHoca) {
      // Sadece bu hocanın atamalarını seçili duruma getir
      const hocaAtamalari = allAtamalar.filter(a => a.user_id === selectedHoca).map(a => a.alt_olcut_id);
      setSelectedOlcutIds(hocaAtamalari);
    } else {
      setSelectedOlcutIds([]);
    }
  }, [selectedHoca, allAtamalar]);

  const fetchInitialData = useCallback(async () => {
    if (!selectedPeriod) return;
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Kullanıcı oturumu bulunamadı.");

      // Admin kontrolü
      const { data: userProfile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
      const role = userProfile?.rol?.toLowerCase() || '';
      const isUserAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
      setIsAdmin(isUserAdmin);

      let expectedDbBaslik: string | null = null;

      if (!isUserAdmin) {
        // Koordinatörün başlığını bul
        const { data: coordData, error: coordError } = await supabase
          .from('baslik_koordinatorleri')
          .select('baslik')
          .eq('kullanici_id', user.id)
          .maybeSingle();

        if (coordError || !coordData) {
          // Hata fırlatmak yerine uyarı veriyoruz ki sayfa dışarı atmasın
          setMessage({ type: 'error', text: "Koordinatör yetkiniz doğrulanamadı. Lütfen bir yöneticiye danışın." });
          setIsLoading(false);
          return;
        }
        
        setCoordinatorTopic(coordData.baslik);

        const baslikMap: Record<string, string> = {
          'Kalite Güvencesi': 'KALİTE GÜVENCESİ SİSTEMİ',
          'Eğitim-Öğretim': 'EĞİTİM VE ÖĞRETİM',
          'Araştırma ve Geliştirme': 'ARAŞTIRMA VE GELİŞTİRME',
          'Toplumsal Katkı': 'TOPLUMSAL KATKI',
          'Yönetim Sistemi': 'YÖNETİM SİSTEMİ'
        };

        expectedDbBaslik = baslikMap[coordData.baslik];
      } else {
        setCoordinatorTopic('Tüm Başlıklar (Süper Yetki)');
      }

      // Ana başlığın ID'sini bul (Sabit eşleştirme)

      // O başlığa ait ölçütleri bul (JS ile filtrele)
      const { data: allBasliklar } = await supabase.from('ana_basliklar').select('id, baslik_adi, kod');
      const { data: allOlcutlerData } = await supabase
        .from('olcutler')
        .select('*');

      // O başlığa ait alt ölçütleri bul (JS ile filtrele)
      const { data: allAltOlcutlerData } = await supabase
        .from('alt_olcutler')
        .select('*')
        .order('id', { ascending: true });

      // Veritabanı ve JSON simülasyonunu tam da kullanıcının istediği gibi oluşturuyoruz
      const tumOlcutler = (allBasliklar || []).map(ana => {
        const anaOlcutler = (allOlcutlerData || []).filter(o => o.ana_baslik_id === ana.id || (o.kod && ana.kod && o.kod.startsWith(ana.kod)));
        const anaAltOlcutler = (allAltOlcutlerData || []).filter(ao => {
          return anaOlcutler.some(o => o.id === ao.olcut_id) || (ao.kod && ana.kod && ao.kod.startsWith(ana.kod));
        });
        return {
          baslik: ana.baslik_adi,
          kod: ana.kod,
          id: ana.id,
          olcutler: anaOlcutler,
          altOlcutler: anaAltOlcutler
        };
      });

      if (isUserAdmin) {
        setOlcutler(allOlcutlerData || []);
        setAltOlcutler(allAltOlcutlerData || []);
        
        const { data: atamalarData } = await supabase
          .from('kullanici_olcut_atamalari')
          .select('*')
          .eq('donem_id', selectedPeriod.id);
          
        setAllAtamalar(atamalarData || []);
      } else {
        const seciliAnaBaslik = tumOlcutler.find(olcut => olcut.baslik === expectedDbBaslik);
        
        if (seciliAnaBaslik) {
          setOlcutler(seciliAnaBaslik.olcutler.length > 0 ? seciliAnaBaslik.olcutler : [{ id: seciliAnaBaslik.id, kod: seciliAnaBaslik.kod || '', ad: seciliAnaBaslik.baslik }]);
          const filteredAltOlcutler = seciliAnaBaslik.altOlcutler;
          setAltOlcutler(filteredAltOlcutler);
          // Bu dönem için tüm atamaları getir (Sadece bu alt ölçütler için)
          const altOlcutIds = filteredAltOlcutler.map(ao => ao.id);
          
          const { data: atamalarData } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('*')
            .eq('donem_id', selectedPeriod.id)
            .in('alt_olcut_id', altOlcutIds.length > 0 ? altOlcutIds : [0]);

          setAllAtamalar(atamalarData || []);
        } else {
          setOlcutler([]);
          setAltOlcutler([]);
          setAllAtamalar([]);
        }
      }

      // Birim sorumlularını getir
      const { data: profillerData } = await supabase
        .from('profiller')
        .select('*')
        .ilike('rol', '%Birim%Sorumlusu%');
      
      setHocalar(profillerData || []);


      
    } catch (error: any) {
      console.error("Veri çekme hatası:", error);
      setMessage({ type: 'error', text: error.message || 'Veriler yüklenirken hata oluştu.' });
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const syncAtamalar = async () => {
      if (selectedHoca) {
        // Sadece bu hocanın atamalarını seçili duruma getir
        const hocaAtamalari = allAtamalar.filter(a => a.user_id === selectedHoca).map(a => a.alt_olcut_id);
        setSelectedOlcutIds(hocaAtamalari);
      } else {
        setSelectedOlcutIds(prev => prev.length > 0 ? [] : prev);
      }
    };
    syncAtamalar();
  }, [selectedHoca, allAtamalar]);

  const handleToggleOlcut = (id: number) => {
    setSelectedOlcutIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!selectedHoca || !selectedPeriod) return;
    
    setIsSaving(true);
    setMessage(null);

    try {
      const altOlcutIds = altOlcutler.map(ao => ao.id);
      
      // rpc_v3_sync_birim_atamalari kullanarak atomik işlem yapıyoruz.
      // Bu fonksiyon o başlık altındaki eski atamaları siler,
      // admin ise başkasından çeker ve yenileri ekler.
      const { error } = await supabase.rpc('rpc_v3_sync_birim_atamalari', {
        p_user_id: selectedHoca,
        p_donem_id: selectedPeriod.id,
        p_scope_olcut_ids: altOlcutIds,
        p_selected_olcut_ids: selectedOlcutIds
      });

      if (error) {
        if (error.code === '23505') {
            throw new Error('Seçtiğiniz ölçütlerden biri halihazırda başka bir kullanıcıya atanmış. Lütfen sayfayı yenileyip tekrar deneyin.');
        }
        throw error;
      }

      setMessage({ type: 'success', text: 'Atamalar başarıyla kaydedildi.' });
      
      // State'i güncellemek için atamaları tekrar çek
      const { data: yeniAtamalarData } = await supabase
        .from('kullanici_olcut_atamalari')
        .select('*')
        .eq('donem_id', selectedPeriod.id)
        .in('alt_olcut_id', altOlcutIds.length > 0 ? altOlcutIds : [0]);
        
      setAllAtamalar(yeniAtamalarData || []);
      
    } catch (error: any) {
      console.error("Kaydetme hatası:", error);
      setMessage({ type: 'error', text: error.message || 'Atama kaydedilirken hata oluştu.' });
    } finally {
      setIsSaving(false);
    }
  };

  const getFullName = (u: any) => {
    if (!u) return 'Bilinmeyen Kullanıcı';
    const name = u.raw_user_meta_data?.full_name || u.full_name || u.isim || u.ad_soyad || (u.ad && u.soyad ? `${u.ad} ${u.soyad}` : null) || u.ad || u.name;
    if (!name) return u.email || 'İsimsiz';
    return `${u.unvan ? u.unvan + ' ' : ''}${name}`;
  };

  const filteredHocalar = hocalar.filter(h => 
    getFullName(h).toLowerCase().includes(searchTerm.toLowerCase()) || 
    (h.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 mx-auto max-w-6xl animate-in fade-in duration-500">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <Users className="w-7 h-7 text-blue-600" />
          Birim Atamaları {coordinatorTopic ? `(${coordinatorTopic})` : ''}
        </h2>
        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          Sorumlu olduğunuz başlık altındaki ölçütleri ilgili birim sorumlularına atayın. Bir alt ölçüt yalnızca bir kişiye atanabilir.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <div>
            <h3 className="text-sm font-semibold">{message.type === 'success' ? 'Başarılı' : 'Hata'}</h3>
            <p className="text-sm opacity-90">{message.text}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !coordinatorTopic ? (
        <div className="bg-yellow-50 text-yellow-800 p-6 rounded-xl border border-yellow-200 text-center">
          Koordinatör yetkiniz bulunmamaktadır.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sol: Kullanıcı Listesi */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-250px)] flex flex-col">
            <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">Birim Sorumluları</h3>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Kullanıcı ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {filteredHocalar.map(hoca => {
                const assignedCount = allAtamalar.filter(a => a.user_id === hoca.id).length;
                return (
                  <button
                    key={hoca.id}
                    onClick={() => setSelectedHoca(hoca.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedHoca === hoca.id 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium text-sm text-slate-800">{getFullName(hoca)}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{hoca.email}</div>
                    {assignedCount > 0 && (
                      <div className="mt-2 text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded inline-block">
                        {assignedCount} Atama
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sağ: Ölçüt Seçimi */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-250px)] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-semibold text-slate-800">
                {selectedHoca 
                  ? `${getFullName(hocalar.find(h => h.id === selectedHoca))} için Atamalar`
                  : 'Ölçüt Ataması İçin Kullanıcı Seçin'}
              </h3>
              
              <button
                onClick={handleSave}
                disabled={!selectedHoca || isSaving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Değişiklikleri Kaydet
              </button>
            </div>

            {!selectedHoca ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Users className="w-12 h-12 mb-3 opacity-20" />
                <p>Soldaki listeden bir kullanıcı seçerek başlayın.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {olcutler.map(olcut => {
                  const olcutunAltOlcutleri = altOlcutler.filter(ao => ao.olcut_id === olcut.id);
                  const displayAltOlcutler = olcutunAltOlcutleri.length > 0 ? olcutunAltOlcutleri : altOlcutler;
                  
                  if (displayAltOlcutler.length === 0) return null;
                  
                  return (
                    <div key={olcut.id} className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <h4 className="font-medium text-slate-800 text-sm">
                          {olcut.kod} {olcut.olcut_adi || olcut.ad || olcut.baslik || olcut.isim || olcut.title || 'İsim Bulunamadı'}
                        </h4>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {displayAltOlcutler.map(ao => {
                          const isSelected = selectedOlcutIds.includes(ao.id);
                          
                          // Bu alt ölçüt başka birine atanmış mı kontrol et
                          const assignedToOther = allAtamalar.find(
                            a => a.alt_olcut_id === ao.id && a.user_id !== selectedHoca
                          );
                          const isAssignedToOther = !!assignedToOther;
                          const otherUser = isAssignedToOther ? hocalar.find(h => h.id === assignedToOther.user_id) : null;

                          return (
                            <label 
                              key={ao.id} 
                              className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                                isAssignedToOther && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                              }`}
                            >
                              <div className="pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isAssignedToOther && !isAdmin}
                                  onChange={() => handleToggleOlcut(ao.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-700">
                                  {ao.kod} - {ao.olcut_adi || ao.ad || ao.baslik || ao.isim || ao.title || 'İsim Bulunamadı'}
                                </div>
                                {isAssignedToOther && (
                                  <div className="text-xs text-red-500 mt-1 font-medium bg-red-50 inline-block px-2 py-0.5 rounded">
                                    Atandı: {otherUser ? getFullName(otherUser) : 'Başka Birim'}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {altOlcutler.length === 0 && (
                  <div className="text-center py-8 text-slate-500">Bu başlığa ait alt ölçüt bulunamadı.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
