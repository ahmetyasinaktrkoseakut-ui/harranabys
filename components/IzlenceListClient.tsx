'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, Eye, Edit3, Lock, GraduationCap, ArrowRight } from 'lucide-react';

interface IzlenceListClientProps {
  initialDersler: any[];
  izlenceler: any[];
  user: any;
  kategoriler: string[];
  isAuthorizedToEdit?: boolean;
}

export default function IzlenceListClient({ initialDersler, izlenceler, user, kategoriler, isAuthorizedToEdit }: IzlenceListClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('HEPSİ');

  const filteredDersler = useMemo(() => {
    return initialDersler.filter(ders => {
      const matchesSearch = 
        ders.ad.toLowerCase().includes(searchTerm.toLowerCase()) || 
        ders.kod.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesKategori = selectedKategori === 'HEPSİ' || ders.yariyil === selectedKategori;
      return matchesSearch && matchesKategori;
    });
  }, [initialDersler, searchTerm, selectedKategori]);

  const activeKategoriler = useMemo(() => {
    if (selectedKategori !== 'HEPSİ') return [selectedKategori];
    return kategoriler;
  }, [kategoriler, selectedKategori]);

  const isTrulyFilled = (icerik: any) => {
    if (!icerik) return false;
    const hasGenel = icerik.amac && icerik.amac.length > 5;
    const hasOC = Array.isArray(icerik.ogrenimCiktilari) && icerik.ogrenimCiktilari.some((oc: any) => oc.cikti);
    const hasHaftalik = Array.isArray(icerik.haftalikIcerik) && icerik.haftalikIcerik.length > 5;
    const hasDegerlendirme = Array.isArray(icerik.degerlendirme) && icerik.degerlendirme.some((d: any) => d.yuzde > 0);
    const hasAKTS = Array.isArray(icerik.aktsIsYuku) && icerik.aktsIsYuku.length > 0;
    const hasMatris = Array.isArray(icerik.pcMatris) && icerik.pcMatris.length > 0;
    
    return hasGenel && hasOC && hasHaftalik && hasDegerlendirme && hasAKTS && hasMatris;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xl border border-blue-100 flex flex-col md:flex-row gap-4 items-center sticky top-0 z-50 backdrop-blur-md bg-white/90">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Ders adı veya kodu ile ara..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="text-blue-600 w-5 h-5 hidden md:block" />
          <select
            className="flex-1 md:flex-none bg-slate-50 border border-slate-200 py-3 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 cursor-pointer"
            value={selectedKategori}
            onChange={(e) => setSelectedKategori(e.target.value)}
          >
            <option value="HEPSİ">TÜM DÖNEMLER</option>
            {kategoriler.map(kat => (
              <option key={kat} value={kat}>{kat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Curriculum Tables */}
      <div className="space-y-12">
        {activeKategoriler.map((kat) => {
          const katDersleri = filteredDersler.filter(d => d.yariyil === kat);
          if (katDersleri.length === 0) return null;

          return (
            <div key={kat} className="overflow-hidden shadow-2xl border border-blue-100 rounded-2xl bg-white transition-all hover:shadow-blue-900/5">
              <div className="bg-gradient-to-r from-blue-900 to-blue-800 py-4 text-center">
                <h2 className="text-lg font-black text-white tracking-[0.2em] uppercase">{kat}</h2>
              </div>

              <div className="overflow-x-auto">
                {/* Masaüstü Görünüm (Tablo) */}
                <table className="w-full border-collapse text-[13px] hidden md:table">
                  <thead>
                    <tr className="bg-slate-50 text-blue-900 font-bold border-b border-blue-100">
                      <th rowSpan={2} className="p-4 w-24 text-center">Ders Kodu</th>
                      <th rowSpan={2} className="p-4 w-16 text-center border-x border-blue-50">Türü</th>
                      <th rowSpan={2} className="p-4 text-left">Dersin Adı</th>
                      <th colSpan={3} className="p-2 text-center bg-blue-50/50 border-x border-blue-50 text-[10px] tracking-widest uppercase">Kredi Dağılımı</th>
                      <th rowSpan={2} className="p-4 w-24 text-center border-x border-blue-50">Ders Dili</th>
                      <th rowSpan={2} className="p-4 w-16 text-center">Kredi</th>
                      <th rowSpan={2} className="p-4 w-16 text-center border-l border-blue-50">AKTS</th>
                    </tr>
                    <tr className="bg-slate-50 text-blue-900 font-bold border-b border-blue-100">
                      <th className="p-2 w-12 text-center border-x border-blue-50 bg-blue-50/30">T</th>
                      <th className="p-2 w-12 text-center border-r border-blue-50 bg-blue-50/30">U</th>
                      <th className="p-2 w-12 text-center border-r border-blue-50 bg-blue-50/30">L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {katDersleri.map((ders, idx) => {
                      const izlence = (izlenceler || []).find(i => i.ders_id === ders.kod);
                      const isFilled = isTrulyFilled(izlence?.icerik);
                      
                      const isPlaceholder = ders.ad.toLowerCase().includes('seçmeli');
                      const canEdit = isAuthorizedToEdit && !isPlaceholder;
                      const canView = isFilled && !isPlaceholder;

                      return (
                        <tr key={`${ders.kod}-${ders.ad}-${idx}`} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="p-4 text-center font-mono font-bold text-slate-400 group-hover:text-blue-600 transition-colors">{ders.kod}</td>
                          <td className="p-4 text-center font-black text-blue-900 border-x border-slate-50">{ders.tur}</td>
                          <td className="p-4 font-bold">
                            {canEdit ? (
                              <Link href={`/ders-izlenceleri?kod=${ders.kod}`} className="text-blue-700 hover:text-blue-900 flex items-center justify-between group/link">
                                <span className="group-hover/link:underline">{ders.ad}</span>
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                  DÜZENLE <Edit3 className="w-3 h-3" />
                                </div>
                              </Link>
                            ) : canView ? (
                              <Link href={`/izlenceler/${ders.kod}`} className="text-blue-700 hover:text-blue-900 flex items-center justify-between group/link">
                                <span className="group-hover/link:underline">{ders.ad}</span>
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                  GÖRÜNTÜLE <Eye className="w-3 h-3" />
                                </div>
                              </Link>
                            ) : (
                              <div className="text-slate-400 flex items-center justify-between">
                                <span>{ders.ad}</span>
                                {!isPlaceholder && (
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300">
                                    <Lock className="w-3 h-3" /> HENÜZ DOLMADI
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center font-bold border-x border-slate-50">{ders.t}</td>
                          <td className="p-4 text-center font-bold border-r border-slate-50">{ders.u}</td>
                          <td className="p-4 text-center font-bold border-r border-slate-50">{ders.l}</td>
                          <td className="p-4 text-center font-bold border-r border-slate-50 text-slate-500">{ders.dil || 'TR'}</td>
                          <td className="p-4 text-center font-bold text-blue-900">{ders.kredi}</td>
                          <td className="p-4 text-center font-black text-blue-900 border-l border-slate-50 bg-blue-50/20">{ders.akts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobil Görünüm (Kartlar) */}
                <div className="grid grid-cols-1 gap-4 p-4 md:hidden bg-slate-50">
                  {katDersleri.map((ders, idx) => {
                    const izlence = (izlenceler || []).find(i => i.ders_id === ders.kod);
                    const isFilled = isTrulyFilled(izlence?.icerik);
                    
                    const isPlaceholder = ders.ad.toLowerCase().includes('seçmeli');
                    const canEdit = isAuthorizedToEdit && !isPlaceholder;
                    const canView = isFilled && !isPlaceholder;

                    return (
                      <div key={`mobile-${ders.kod}-${idx}`} className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-blue-700 text-sm">{ders.kod}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase mt-1">{ders.tur} • {ders.dil || 'TR'}</span>
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-1 rounded">Kredi: {ders.kredi}</div>
                            <div className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-1 rounded">AKTS: {ders.akts}</div>
                          </div>
                        </div>
                        
                        <h3 className="font-bold text-slate-800 text-sm mb-4 leading-snug">{ders.ad}</h3>
                        
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                          <div className="flex gap-3 text-[11px] font-black text-slate-500">
                            <span className="bg-slate-100 px-2 py-1 rounded">T: {ders.t}</span>
                            <span className="bg-slate-100 px-2 py-1 rounded">U: {ders.u}</span>
                            <span className="bg-slate-100 px-2 py-1 rounded">L: {ders.l}</span>
                          </div>
                          <div>
                            {canEdit ? (
                              <Link href={`/ders-izlenceleri?kod=${ders.kod}`} className="text-[10px] font-black bg-amber-50 text-amber-600 px-3 py-2 rounded-lg flex items-center gap-1 border border-amber-100">
                                DÜZENLE <Edit3 className="w-3 h-3" />
                              </Link>
                            ) : canView ? (
                              <Link href={`/izlenceler/${ders.kod}`} className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg flex items-center gap-1 border border-emerald-100">
                                GÖRÜNTÜLE <Eye className="w-3 h-3" />
                              </Link>
                            ) : (
                              <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                <Lock className="w-3 h-3" /> HENÜZ DOLMADI
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {filteredDersler.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <GraduationCap className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest">Aradığınız kriterlere uygun ders bulunamadı.</p>
            <button 
              onClick={() => { setSearchTerm(''); setSelectedKategori('HEPSİ'); }}
              className="mt-4 text-blue-600 font-black hover:underline flex items-center gap-2 mx-auto"
            >
              Tüm dersleri göster <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
