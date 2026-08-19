import { createClient } from '@/lib/supabase/server';
import { 
  FileCheck, 
  FileX, 
  User, 
  Calendar, 
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import SyllabusShareClient from '@/components/SyllabusShareClient';

export const dynamic = 'force-dynamic';

export default async function IzlenceTakipPage() {
  const supabase = await createClient();
  
  // Yetki kontrolü
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-center font-bold text-slate-500">Giriş yapmalısınız.</div>;

  const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
  const role = profile?.rol?.toLowerCase() || '';
  const isAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');

  if (!isAdmin) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <h1 className="text-3xl font-black text-red-600 tracking-tighter">YETKİSİZ ERİŞİM</h1>
        <p className="text-slate-400 font-bold mt-2">Bu sayfayı sadece sistem yöneticileri görüntüleyebilir.</p>
      </div>
    );
  }

  // Tüm verileri çek
  const { data: derslerRaw } = await supabase
    .from('dersler')
    .select('*')
    .order('kod', { ascending: true });

  // Placeholder'ları (Seçmeli Ders X) takipten çıkar, sadece gerçek dersleri göster
  const dersler = (derslerRaw || []).filter(d => !d.ad.toLowerCase().includes('seçmeli'));

  const { data: izlenceler } = await supabase
    .from('ders_izlenceleri')
    .select('ders_id, hoca_id, guncelleme_tarihi, icerik');

  const { data: profiller } = await supabase
    .from('profiller')
    .select('id, ad_soyad, unvan');

  // İzlence tam dolu mu kontrol et (5 ana bölüm)
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

  // İzlence durumlarını hesapla
  const total = dersler?.length || 0;
  const filled = izlenceler?.filter(i => isTrulyFilled(i.icerik)).length || 0;
  const stats = {
    total,
    filled,
    pending: total - filled
  };
  const completionRate = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <SyllabusShareClient />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div className="flex items-center gap-4">
          <Link 
            href="/izlenceler" 
            className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">İzlence Veri Takibi</h1>
            <p className="text-slate-500 font-medium">Öğretim görevlilerinin izlence giriş durumlarını anlık takip edin.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-blue-50 px-6 py-4 rounded-3xl border border-blue-100">
          <div className="text-right">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Genel Tamamlanma</p>
            <p className="text-2xl font-black text-blue-700">%{completionRate}</p>
          </div>
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <FileCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Toplam Ders</p>
            <p className="text-2xl font-black text-slate-800">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-emerald-500 text-sm font-bold uppercase tracking-wider">Doldurulan</p>
            <p className="text-2xl font-black text-emerald-700">{stats.filled}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-100">
            <XCircle className="w-7 h-7" />
          </div>
          <div>
            <p className="text-amber-500 text-sm font-bold uppercase tracking-wider">Eksik Olan</p>
            <p className="text-2xl font-black text-amber-700">{stats.pending}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Ders Kodu</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Ders Adı</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Durum</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Sorumlu Hoca</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Son Güncelleme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(dersler || []).map((ders) => {
                const izlence = (izlenceler || []).find(i => i.ders_id === ders.kod);
                const isFilled = isTrulyFilled(izlence?.icerik);
                const hoca = profiller?.find(p => p.id === izlence?.hoca_id);
                
                return (
                  <tr key={ders.kod} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm font-bold text-slate-400">{ders.kod}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{ders.ad}</td>
                    <td className="px-6 py-4 text-center">
                      {isFilled ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 shadow-sm">
                          <FileCheck className="w-3.5 h-3.5" />
                          TAMAMLANDI
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100 shadow-sm">
                          <FileX className="w-3.5 h-3.5" />
                          EKSİK
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {hoca ? (
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium">{hoca.unvan} {hoca.ad_soyad}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 font-bold tracking-widest italic">HENÜZ ATANMAMIŞ</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {izlence?.guncelleme_tarihi ? (
                        <div className="flex items-center justify-end gap-2 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{new Date(izlence.guncelleme_tarihi).toLocaleDateString('tr-TR')}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-200">Yok</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
