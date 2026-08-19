'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { 
  Save, ArrowLeft, Plus, Trash2, 
  BookOpen, Clock, Target, ListChecks, 
  FileText, BarChart3, Settings, ShieldCheck,
  ChevronRight, ChevronLeft, GraduationCap, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Course {
  kod: string;
  ad: string;
  t: number;
  u: number;
  l: number;
  kredi: number;
  akts: number;
  dil: string;
  yariyil: string;
  tur: string;
}

const DEFAULT_POLICIES = `• Ders Süresi ve İşleyişi: Ders toplamda 3 saat sürecek şekilde planlanmıştır ve 1 saatlik iki blok halinde işlenecektir. Bloklar arasında 15 dakikalık bir ara verilecektir.
• Dijital Araçların Kullanımı: Ders sırasında cep telefonu, tablet, dizüstü bilgisayar vb. kişisel elektronik/dijital cihazlarla dersin herhangi bir bölümünü kaydedemezsiniz.
• Devam Durumu: Eskişehir Osmangazi Üniversitesi Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği 16. Madde gereği "Öğrenci, teorik ders çalışmalarının %70'ine, laboratuvar ve uygulama çalışmalarının %80'ine devam etmek zorundadır."
• Öğrenci Merkezli Öğrenme: Ders, öğrenci merkezli bir yaklaşımla yürütülecektir. Bu kapsamda öğrencilerin katılımı desteklenecek, öğrenme sürecine dair sorumluluk almaları beklenecek ve ders sürecine dair geri bildirimleri alınacaktır.
• Engelli Öğrenci Desteği: Sizin için engel oluşturabilecek durumlarla (görme, işitme vb.) ilgili olarak doğrudan benimle iletişime geçebilirsiniz.
• Sözlü ve Yazılı İletişim Etiği: Sınıf tartışmaları sırasında birbirinize saygı göstererek ve nefret söylemi kullanmadan yorumlar yapabilirsiniz. Sunumlarınızda veya yazılı ödevlerinizde herhangi bir kaynağı kullanırken yazarları ve web materyallerini referans göstermeyi unutmayın.
• Grup Çalışmaları ve Ekip Çalışması Etiği: Grup çalışmaları sırasında tüm öğrencilerin eşit katılım göstermesi ve iş birliği içinde çalışması beklenmektedir.
• Ödev Teslimi: Özellikle vize sonrası ek puan talebinde bulunan öğrenciler için ekstra ödev seçenekleri sunulabilir. Bu ödevler, öğretim elemanı tarafından belirlenecek bir konu çerçevesinde hazırlanmalı ve teslim edilmelidir.
• Yapay Zeka Kullanımı: Bu derste yapay zeka araçları sınırlı ve sorumlu biçimde kullanılabilir. Yapay zeka, öğrencinin kendi öğrenme sürecini destekleyen bir yardımcı olarak görülür; öğrencinin yerine düşünme, analiz etme veya akademik üretim yapma aracı değildir.`;

const AKTS_ROWS = [
  "Ders Süresi (Sınav Haftası Dahil Haftalık Toplam Ders Saati)",
  "Sınıf Dışı Ders Çalışma Süresi (Tekrar, Pekiştirme, Ön Çalışma vb.)",
  "Ödev", "Kısa Sınav", "Kısa Sınav Hazırlık", "Sözlü Sınav", "Sözlü Sınav Hazırlık",
  "Rapor (Hazırlık ve Sunum Süresi Dahil)", "Proje (Hazırlık ve Sunum Süresi Dahil)",
  "Sunum (Hazırlık Süresi Dahil)", "Ara Sınav", "Ara Sınav Hazırlık",
  "Yarıyıl Sonu Sınavı", "Yarıyıl Sonu Sınavı Hazırlık"
];

const PROGRAM_OUTCOMES = [
  "İlahiyat alanına ilişkin temel kavram ve kuramları bilir, bunları kullanarak güncel olay ve olguları açıklar.",
  "Sahip olduğu yabancı dil bilgisi ile alanındaki yeni çalışmaları ve bilimsel gelişmeleri takip eder, elde ettiği yabancı literatürdeki bilgileri ilgililerle paylaşır.",
  "Sosyal, kültürel ve evrensel değerleri benimser, araştırma, iletişim ve eylemlerinde erdemli davranışlar sergiler, tarihi ve kültürel mirasın aktarımına katkı sağlar.",
  "Alanıyla ilgili karşılaştığı sorunları doğru bir şekilde tanımlar, bunlara disipliner ve disiplinlerarası çalışmalarla uygun çözüm ve alternatifler geliştirir ve bunları ilgili kurumlarla paylaşır.",
  "Değişen ve gelişen yerel / küresel sosyal ve politik konjonktürü yakından takip eder ve yeni şartlara uygun anlayış ve yaklaşımlar geliştirir.",
  "Dini anlayış ve uygulamaların bireysel, toplumsal ve evrensel boyuttaki yansımalarını fark eder. Toplumsal hayatta ortaya çıkan ihtiyaç ve sorunlara dini alandan bilimsel çözümler sunar ve bunları ilgili kurumlarla paylaşır.",
  "Alanına ilişkin eğitimsel süreçleri etkin bir şekilde planlar, bu planları uygular ve mesleki ve akademik gelişimine yönelik sosyal, kültürel ve sanatsal etkinliklere katılır.",
  "Alanına ilişkin akademik ve kültürel birikimi eleştirel bir yaklaşımla analiz eder, hayatı boyunca alanına ilişkin yeni öğrenme ortamlarına katılmaya istekli olur.",
  "Sahip olduğu bilgi ve yetkinlikleri alanıyla ilgili eğitim, araştırma ve topluma hizmet faaliyetlerinde yetkin şekilde kullanır.",
  "Alanına ilişkin gerçekleştireceği her türlü araştırma, eğitim ve topluma hizmet faaliyetlerinde birey hak ve özgürlüklerine saygı duyar, toplumsal, ahlaki ve hukuki ilkelere uygun davranışlar sergiler.",
  "Güncel bilişim ve iletişim teknolojilerine ilişkin bilgi ve becerilerini geliştirir, bunlardaki yetkinliklerini alanıyla ilgili faaliyetlerde aktif şekilde kullanır.",
  "İlahiyat alanında eğitim, araştırma ve topluma hizmet boyutlarında sorun çözme ve iyileştirmeye yönelik bireysel ve kurumsal düzeyde faaliyetler planlar ve bunların uygulanmasında sorumluluk üstlenir."
];

const DISCIPLINE_OUTCOMES = [
  "Kur'an-ı Kerim bilgisine, doğru tilavet becerisine ve yeterli ezbere sahip olma",
  "Arapça temel kaynakları okuma ve anlama yetkinliğine sahip olma",
  "İtikat, ibadet, ahlak ve muamelata dair usul ve esasları kavrama ve bu esasların dayandığı temelleri bilme",
  "Kur'an ve sünnet bütünlüğünü esas alan bir yaklaşıma sahip olma",
  "Bütüncül ve sistematik bir dini düşünce ve kavrayışa sahip olma",
  "Zaman ve mekâna göre ortaya çıkan farklı dini yaklaşımları doğru anlama ve tutarlı değerlendirme yetkinliğine sahip olma",
  "Din istismarı, şiddet, İslam karşıtlığı gibi dine ve topluma zararlı eğilimlere karşı söylem ve tutum geliştirebilme yetkinliğine sahip olma",
  "Farklı düşünce ve yorumlar karşısında saygı ve adaleti esas alma yetkinliğine sahip olma",
  "Kişi ve kurumlar yerine ilke ve değerleri üstün tutan bir anlayışa sahip olma",
  "Dinin temel kaynakları ve bilimsel verilere dayalı din eğitimi ve din hizmetleri verme yetkinliğine sahip olma",
  "Toplumun inanç, ibadet, ahlak, örf ve adetlerini İslam'ın temel kaynakları ışığında yorumlama ve toplumu aydınlatma yetkinliğine sahip olma",
  "Dini danışmanlık ve rehberlik bilgi ve becerisine sahip olma",
  "Akıl, bilgi, istişare, emanete riayet, ehliyet ve adalet gibi temel değerler/ilkeler ışığında çalışma ve sorumluluk üstlenebilme yetkinliğine sahip olma",
  "İslam kültür, sanat ve medeniyeti hakkında temel ve bütüncül bilgilere sahip olma"
];

export default function DersIzlencesiClient({ 
  dersler, 
  izlenceler, 
  currentUserId,
  defaultOgretimElemani,
  defaultEposta
}: { 
  dersler: Course[]; 
  izlenceler: any[];
  currentUserId: string;
  defaultOgretimElemani: string;
  defaultEposta: string;
}) {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const kod = urlParams.get('kod');
    if (kod && dersler.length > 0) {
      const ders = dersler.find(d => d.kod === kod);
      if (ders) handleCourseSelect(ders);
    }
  }, [dersler]);

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    const existing = izlenceler.find(i => i.ders_id === course.kod);
    
    const defaultData = {
      ogretimElemani: defaultOgretimElemani,
      eposta: defaultEposta,
      gorusmeGunSaat: '',
      ofis: '',
      donem: course.yariyil,
      gunSaat: '',
      egitimDili: course.dil || 'Türkçe',
      ogretimTuru: 'Örgün Öğretim',
      derslik: '',
      onkosul: '-',
      amac: '',
      ogrenimCiktilari: Array(10).fill(0).map(() => ({ 
        cikti: '', bilgi: false, beceri: false, yetkinlik: false, ogretim: '', olcme: '' 
      })),
      temelKaynaklar: '',
      yardimciKaynaklar: '',
      politikalar: DEFAULT_POLICIES,
      haftalikIcerik: [
        ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 1), konu: '', kaynaklar: '', isYuku: '' })),
        { hafta: 'Arasınav', konu: 'Arasınav Haftası', kaynaklar: '', isYuku: '' },
        ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 8), konu: '', kaynaklar: '', isYuku: '' })),
        { hafta: 'Final', konu: 'Final Haftası', kaynaklar: '', isYuku: '' }
      ],
      degerlendirme: [
        { tur: 'Ara Sınav', aciklama: '', yuzde: 40 },
        { tur: 'Ödev', aciklama: '', yuzde: 0 },
        { tur: 'Sunum', aciklama: '', yuzde: 0 },
        { tur: 'Uygulama', aciklama: '', yuzde: 0 },
        { tur: 'Final', aciklama: '', yuzde: 60 },
        { tur: 'Bütünleme', aciklama: '', yuzde: 0 }
      ],
      harfNotu: 'AA: / BA: / BB: / CB: / CC: / DC: / DD:',
      aktsIsYuku: AKTS_ROWS.map(row => ({ 
        etkinlik: row, sayisi: '', suresi: '', toplam: '' 
      })),
      pcMatris: PROGRAM_OUTCOMES.map((pc, i) => ({ 
        id: `PÇ${i+1}`, metin: pc, ocValues: Array(10).fill('') 
      })),
      docMatris: DISCIPLINE_OUTCOMES.map((doc, i) => ({ 
        id: `DÖÇ${i+1}`, metin: doc, ocValues: Array(10).fill('') 
      }))
    };

    if (existing && existing.icerik && Object.keys(existing.icerik).length > 0) {
      let mergedData = { ...defaultData, ...existing.icerik };
      
      if (mergedData.haftalikIcerik) {
        const hIcerik = [...mergedData.haftalikIcerik];
        const arasInavIdx = hIcerik.findIndex(h => h.hafta === 'Arasınav');
        if (arasInavIdx !== -1 && arasInavIdx !== 7) {
          const [arasinavRow] = hIcerik.splice(arasInavIdx, 1);
          hIcerik.splice(7, 0, arasinavRow);
          let weekCounter = 1;
          hIcerik.forEach((row) => {
            if (row.hafta !== 'Arasınav' && row.hafta !== 'Final') {
              row.hafta = String(weekCounter++);
            }
          });
          mergedData.haftalikIcerik = hIcerik;
        }
      }

      // Backward compatibility for aktsIsYuku (recalc in case it was bad)
      if (mergedData.aktsIsYuku) {
        mergedData.aktsIsYuku = mergedData.aktsIsYuku.map((r: any) => ({
          ...r,
          toplam: ((parseFloat(r.sayisi) || 0) * (parseFloat(r.suresi) || 0)).toString()
        }));
      }

      setFormData(mergedData);
    } else {
      setFormData(defaultData);
    }
  };

  const handleSave = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ders_izlenceleri')
        .upsert({
          ders_id: selectedCourse.kod,
          hoca_id: currentUserId,
          icerik: formData,
          guncelleme_tarihi: new Date().toISOString()
        }, { onConflict: 'ders_id, hoca_id' });

      if (error) throw error;
      toast.success('İzlence başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
      toast.error('Kaydedilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCourse || !formData) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg border border-slate-200">
          <GraduationCap className="w-20 h-20 text-blue-600 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Ders İzlencesi Editörü</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">Lütfen düzenlemek istediğiniz dersi seçin.</p>
          <Link href="/izlenceler" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg">
            <ArrowLeft className="w-5 h-5" /> Eğitim Planına Git
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Sticky */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/izlenceler" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedCourse.kod}</h1>
            <h2 className="text-lg font-bold text-slate-800">{selectedCourse.ad}</h2>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[1, 2, 3, 4, 5].map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                activeStep === step ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'
              }`}
            >
              SAYFA {step}
            </button>
          ))}
        </div>

        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
          <Save className="w-4 h-4" /> {loading ? 'KAYDEDİLİYOR...' : 'KAYDET'}
        </button>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        
        {/* Sayfa 1: Header, Bilgiler ve Öğrenim Çıktıları */}
        {activeStep === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Genel Bilgiler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['ogretimElemani', 'eposta', 'gorusmeGunSaat', 'ofis', 'gunSaat', 'derslik', 'onkosul'].map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {field === 'ogretimElemani' ? 'Öğretim Elemanı' : field === 'eposta' ? 'E-Posta' : field === 'gorusmeGunSaat' ? 'Görüşme Gün ve Saatleri' : field === 'onkosul' ? 'Önkoşul Dersleri' : field}
                    </label>
                    <input
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 transition-all outline-none"
                      value={formData[field]}
                      onChange={e => setFormData({...formData, [field]: e.target.value})}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dersin Amacı</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 transition-all outline-none"
                    value={formData.amac}
                    onChange={e => setFormData({...formData, amac: e.target.value})}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Dersin Öğrenim Çıktıları</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 w-8">#</th>
                      <th className="border p-2 text-left">Dersin Öğrenim Çıktıları</th>
                      <th className="border p-2 w-12 text-center">Bilgi</th>
                      <th className="border p-2 w-12 text-center">Beceri</th>
                      <th className="border p-2 w-12 text-center">Yetkinlik</th>
                      <th className="border p-2 text-left">Öğretim Yöntemleri*</th>
                      <th className="border p-2 text-left">Ölçme Yöntemleri**</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.ogrenimCiktilari || []).map((oc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 text-center font-bold">{i + 1}</td>
                        <td className="border p-1"><input className="w-full p-2 outline-none focus:bg-blue-50" value={oc.cikti} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].cikti = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.bilgi} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].bilgi = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.beceri} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].beceri = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.yetkinlik} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].yetkinlik = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none" value={oc.ogretim} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].ogretim = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none" value={oc.olcme} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].olcme = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 2: Kaynaklar ve Politikalar */}
        {activeStep === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders Kaynakları</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temel Ders Kitabı</label>
                  <textarea rows={3} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.temelKaynaklar} onChange={e => setFormData({...formData, temelKaynaklar: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yardımcı Kaynaklar</label>
                  <textarea rows={3} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.yardimciKaynaklar} onChange={e => setFormData({...formData, yardimciKaynaklar: e.target.value})} />
                </div>
              </div>
            </section>
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders Politikaları</h3>
              <textarea rows={15} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-4 font-medium text-slate-700 outline-none text-sm leading-relaxed" value={formData.politikalar} onChange={e => setFormData({...formData, politikalar: e.target.value})} />
            </section>
          </div>
        )}

        {/* Sayfa 3: Haftalık İçerik ve Değerlendirme */}
        {activeStep === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Haftalık Ders İçeriği</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 w-16">Hafta</th>
                      <th className="border p-2 text-left">Konu Başlığı</th>
                      <th className="border p-2 text-left">İlgili Kaynaklar</th>
                      <th className="border p-2 w-32 text-center">Öğrenci İş Yükü</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.haftalikIcerik || []).map((row: any, i: number) => (
                      <tr key={i} className={row.hafta === 'Arasınav' || row.hafta === 'Final' ? 'bg-blue-50' : ''}>
                        <td className="border p-2 text-center font-bold">{row.hafta}</td>
                        <td className="border p-1"><input className="w-full p-2 outline-none bg-transparent" value={row.konu} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].konu = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none bg-transparent" value={row.kaynaklar} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].kaynaklar = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 text-center outline-none bg-transparent" value={row.isYuku} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].isYuku = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders Değerlendirme</h3>
              <table className="w-full border-collapse border border-slate-200 text-[11px] mb-6">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border p-2 text-left">Değerlendirme Türü</th>
                    <th className="border p-2 text-left">Açıklama</th>
                    <th className="border p-2 w-20 text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.degerlendirme || []).map((d: any, i: number) => (
                    <tr key={i}>
                      <td className="border p-2 font-bold">{d.tur}</td>
                      <td className="border p-1"><input className="w-full p-2 outline-none" value={d.aciklama} onChange={e => {
                        const newD = [...formData.degerlendirme]; newD[i].aciklama = e.target.value; setFormData({...formData, degerlendirme: newD});
                      }} /></td>
                      <td className="border p-1"><input type="number" className="w-full p-2 text-center outline-none" value={d.yuzde} onChange={e => {
                        const newD = [...formData.degerlendirme]; newD[i].yuzde = parseInt(e.target.value) || 0; setFormData({...formData, degerlendirme: newD});
                      }} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black">
                    <td colSpan={2} className="border p-2 text-right">TOPLAM</td>
                    <td className="border p-2 text-center">{formData.degerlendirme.reduce((acc: number, d: any) => acc + d.yuzde, 0)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harf Notu Baremi</label>
                <input className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.harfNotu} onChange={e => setFormData({...formData, harfNotu: e.target.value})} />
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 4: AKTS İş Yükü ve PÇ Matrisi (PÇ1-8) */}
        {activeStep === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">AKTS - İş Yükü Tablosu</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 text-left">Etkinlikler</th>
                      <th className="border p-2 w-24 text-center">Sayısı</th>
                      <th className="border p-2 w-24 text-center">Süresi (Saat)</th>
                      <th className="border p-2 w-24 text-center">Toplam İş Yükü (Saat)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.aktsIsYuku || []).map((row: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 font-medium">{row.etkinlik}</td>
                        <td className="border p-1"><input type="number" className="w-full p-2 text-center outline-none bg-transparent" value={row.sayisi} onChange={e => {
                          const newA = [...formData.aktsIsYuku]; 
                          newA[i].sayisi = e.target.value; 
                          newA[i].toplam = ((parseFloat(newA[i].sayisi) || 0) * (parseFloat(newA[i].suresi) || 0)).toString();
                          setFormData({...formData, aktsIsYuku: newA});
                        }} /></td>
                        <td className="border p-1"><input type="number" className="w-full p-2 text-center outline-none bg-transparent" value={row.suresi} onChange={e => {
                          const newA = [...formData.aktsIsYuku]; 
                          newA[i].suresi = e.target.value; 
                          newA[i].toplam = ((parseFloat(newA[i].sayisi) || 0) * (parseFloat(newA[i].suresi) || 0)).toString();
                          setFormData({...formData, aktsIsYuku: newA});
                        }} /></td>
                        <td className="border p-1 bg-slate-50 text-slate-600 font-bold text-center">
                          {row.toplam || '0'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black text-slate-700">
                      <td colSpan={3} className="border p-2 text-right uppercase text-[10px] tracking-widest">Toplam İş Yükü</td>
                      <td className="border p-2 text-center text-blue-600">
                        {formData.aktsIsYuku?.reduce((acc: number, row: any) => acc + (parseFloat(row.toplam) || 0), 0) || 0}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-black text-slate-700">
                      <td colSpan={3} className="border p-2 text-right uppercase text-[10px] tracking-widest">Toplam İş Yükü / 30</td>
                      <td className="border p-2 text-center text-blue-600">
                        {((formData.aktsIsYuku?.reduce((acc: number, row: any) => acc + (parseFloat(row.toplam) || 0), 0) || 0) / 30).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-black text-slate-800">
                      <td colSpan={3} className="border p-3 text-right uppercase text-[11px] tracking-widest">Dersin AKTS Kredisi</td>
                      <td className="border p-3 text-center text-purple-700 text-lg">
                        {Math.ceil((formData.aktsIsYuku?.reduce((acc: number, row: any) => acc + (parseFloat(row.toplam) || 0), 0) || 0) / 30)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-4 uppercase tracking-widest">Dersin Öğrenim Çıktılarının (ÖÇ) Program Çıktıları (PÇ) ile Olan İlişkisi</h3>
              <p className="text-[10px] text-slate-400 mb-6 font-bold">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={2} className="border p-2 text-left">PÇ No / Metin</th>
                      <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900">Öğrenme Çıktıları</th>
                    </tr>
                    <tr className="bg-slate-50">
                      {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-8 text-center">ÖÇ{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.pcMatris || []).map((pc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 w-64"><span className="font-black text-blue-900">{pc.id}:</span> {pc.metin}</td>
                        {Array(10).fill(0).map((_, j) => (
                          <td key={j} className="border p-1">
                            <input className="w-full text-center outline-none bg-transparent font-black" value={pc.ocValues[j]} maxLength={1} onChange={e => {
                              const newM = [...formData.pcMatris]; newM[i].ocValues[j] = e.target.value; setFormData({...formData, pcMatris: newM});
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 5: DÖÇ Matrisi (DÖÇ1-14) */}
        {activeStep === 5 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-4 uppercase tracking-widest">Ders Öğrenim Çıktılarının (ÖÇ) İAA Disipline Özgü Çıktılar (DÖÇ) ile Olan İlişkisi</h3>
              <p className="text-[10px] text-slate-400 mb-6 font-bold">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={2} className="border p-2 text-left">DÖÇ No / Metin</th>
                      <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900">Öğrenme Çıktıları</th>
                    </tr>
                    <tr className="bg-slate-50">
                      {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-8 text-center">ÖÇ{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.docMatris || []).map((doc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 w-64"><span className="font-black text-blue-900">{doc.id}:</span> {doc.metin}</td>
                        {Array(10).fill(0).map((_, j) => (
                          <td key={j} className="border p-1">
                            <input className="w-full text-center outline-none bg-transparent font-black" value={doc.ocValues[j]} maxLength={1} onChange={e => {
                              const newM = [...formData.docMatris]; newM[i].ocValues[j] = e.target.value; setFormData({...formData, docMatris: newM});
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Navigation Dots */}
        <div className="mt-12 flex items-center justify-between">
          <button onClick={() => setActiveStep(prev => Math.max(1, prev - 1))} disabled={activeStep === 1} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-black text-[10px] px-4 py-2 disabled:opacity-30 transition-colors uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" /> Önceki Sayfa
          </button>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`w-1.5 h-1.5 rounded-full transition-all ${activeStep === s ? 'bg-blue-600 w-6' : 'bg-slate-300'}`} />
            ))}
          </div>
          <button onClick={() => setActiveStep(prev => Math.min(5, prev + 1))} disabled={activeStep === 5} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-black text-[10px] px-4 py-2 disabled:opacity-30 transition-colors uppercase tracking-widest">
            Sonraki Sayfa <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
