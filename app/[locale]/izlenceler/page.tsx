import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Edit3 } from 'lucide-react';
import IzlenceListClient from '@/components/IzlenceListClient';

export const dynamic = 'force-dynamic';

export default async function IzlencelerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAuthorizedToEdit = false;
  if (user) {
    const { data: profileData } = await supabase
      .from('profiller')
      .select('rol')
      .eq('id', user.id);
    
    const profile = profileData?.[0];
    const email = user.email?.toLowerCase() || '';
    const userRole = (profile?.rol || user.user_metadata?.role || '').toLowerCase();
    
    // Daha kapsayıcı Regex kontrolü (Türkçe karakter ve farklı yazım türleri için)
    const isYonetici = /admin|yonetici|yönetici|manager/i.test(userRole) || user.user_metadata?.isAdmin === true;
    const isBirimSorumlusu = /birim/i.test(userRole);
    const isHarranTeacher = email.endsWith('@harran.edu.tr') || email.includes('harran.edu.tr');
    
    isAuthorizedToEdit = isYonetici || isBirimSorumlusu || isHarranTeacher;
  }

  // Tüm dersleri ve izlenceleri çek
  const { data: dersler } = await supabase
    .from('dersler')
    .select('*')
    .order('kod', { ascending: true });

  const { data: izlenceler } = await supabase
    .from('ders_izlenceleri')
    .select('ders_id, icerik');

  const baseDersler = (dersler || []).map(d => {
    // 1. Yarıyıl ismini güncelle
    if (d.ad === 'Sosyal Seçmeli Ders' && d.yariyil === 'I. YARIYIL') {
      return { ...d, ad: 'Sosyal Seçmeli Ders I' };
    }

    const yariyilText = (d.yariyil || '').trim().toUpperCase();
    if (yariyilText === 'SEÇMELİ DERSLER' && d.kod) {
      const semDigit = d.kod.charAt(5);
      const semMap: Record<string, string> = {
        '3': 'SEÇMELİ I DERSLERİ',
        '4': 'SEÇMELİ II DERSLERİ',
        '5': 'SEÇMELİ III DERSLERİ',
        '6': 'SEÇMELİ IV DERSLERİ',
        '7': 'SEÇMELİ V DERSLERİ',
        '8': 'SEÇMELİ VI DERSLERİ'
      };
      if (semMap[semDigit]) {
        return { ...d, yariyil: semMap[semDigit] };
      }
    }
    return d;
  });

  // Her dönem için istenen placeholder'ları enjekte et
  const placeholders = [
    { sem: 'III. YARIYIL', ad: 'Seçmeli Ders I', count: 2 },
    { sem: 'IV. YARIYIL', ad: 'Seçmeli Ders II', count: 2 },
    { sem: 'V. YARIYIL', ad: 'Seçmeli Ders III', count: 2 },
    { sem: 'VI. YARIYIL', ad: 'Seçmeli Ders IV', count: 2 },
    { sem: 'VII. YARIYIL', ad: 'Seçmeli Ders V', count: 2 },
    { sem: 'VIII. YARIYIL', ad: 'Seçmeli Ders VI', count: 2 },
  ];

  const parsedDersler = [...baseDersler];
  placeholders.forEach(p => {
    for (let i = 0; i < p.count; i++) {
      parsedDersler.push({
        kod: '-',
        ad: p.ad,
        yariyil: p.sem,
        tur: 'S',
        t: 0, u: 0, l: 0, kredi: 0, akts: 0, dil: 'TR'
      } as any);
    }
  });

  const getSortOrder = (text: string) => {
    const romanVals: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10 };
    if (text.includes('.')) {
      const roman = text.split('.')[0];
      return romanVals[roman] || 99;
    }
    const match = text.match(/SEÇMELİ\s+([IVX]+)/i);
    if (match && romanVals[match[1]]) return romanVals[match[1]] + 10;
    return 99;
  };

  const kategoriler = Array.from(new Set(parsedDersler.map(d => d.yariyil)))
    .sort((a, b) => getSortOrder(a) - getSortOrder(b));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Premium Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-950 text-white pt-12 pb-24 px-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
              <span className="px-4 py-1.5 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full text-[10px] font-black tracking-[0.2em] uppercase">
                {user ? 'AKADEMİK PANEL' : 'ÖĞRENCİ BİLGİ SİSTEMİ'}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight tracking-tight">
              Eğitim Planı <span className="text-blue-400">&</span> İzlenceler
            </h1>
            <p className="text-blue-100/70 text-lg font-medium max-w-2xl">
              İlahiyat Fakültesi güncel müfredat yapısı ve ders içerikleri. {user ? 'Derslerinizi düzenlemek için listeden seçim yapabilirsiniz.' : 'İzlencesi yüklenen dersleri incelemek için üzerlerine tıklayabilirsiniz.'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <Link 
                href="/" 
                className="group flex items-center gap-3 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-2xl transition-all font-black text-sm border border-white/20 backdrop-blur-xl shadow-lg hover:shadow-white/5 active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                ANA SAYFAYA DÖN
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto -mt-12 px-6">
        <IzlenceListClient 
          initialDersler={parsedDersler} 
          izlenceler={izlenceler || []} 
          user={user} 
          kategoriler={kategoriler} 
          isAuthorizedToEdit={isAuthorizedToEdit}
        />
      </div>
      
      <div className="h-20"></div>
    </div>
  );
}
