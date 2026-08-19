import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, Square } from 'lucide-react';
import PrintButtonClient from '@/components/PrintButtonClient';

export const dynamic = 'force-dynamic';

export default async function IzlenceDetailPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;
  const supabase = await createClient();

  const { data: ders } = await supabase.from('dersler').select('*').eq('kod', kod).maybeSingle();
  if (!ders) notFound();

  const { data: izlence } = await supabase
    .from('ders_izlenceleri')
    .select('*')
    .eq('ders_id', kod)
    .order('guncelleme_tarihi', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!izlence || !izlence.icerik) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{ders.ad}</h1>
        <p className="text-slate-500 mb-6 text-sm uppercase tracking-widest font-black">Bu ders için henüz bir izlence hazırlanmamış.</p>
        <Link href="/izlenceler" className="text-blue-600 hover:underline font-bold">← Eğitim Planına Dön</Link>
      </div>
    );
  }

  const c = izlence.icerik;

  return (
    <div className="bg-slate-100 min-h-screen pb-20">
      {/* Top Navbar (Print Hidden) */}
      <div className="print:hidden sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/izlenceler" className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Eğitim Planı
        </Link>
        <PrintButtonClient />
      </div>

      <div className="max-w-[210mm] mx-auto mt-8 print:mt-0 shadow-2xl bg-white border border-slate-200 print:shadow-none print:border-none">
        
        {/* SAYFA 1: GENEL BİLGİLER & ÖÇ */}
        <div className="p-16 border-b border-dashed border-slate-200 page-break-after-always">
          <div className="text-center mb-12 border-b-4 border-blue-900 pb-10">
            <h1 className="text-xl font-black text-blue-900 mb-1">ESKİŞEHİR OSMANGAZİ ÜNİVERSİTESİ</h1>
            <h2 className="text-lg font-bold text-slate-800 mb-1">İLAHİYAT FAKÜLTESİ</h2>
            <h3 className="text-2xl font-black text-blue-900 mt-6 tracking-tight">DERS İZLENCESİ</h3>
          </div>

          <div className="grid grid-cols-1 gap-1 text-[13px] mb-12">
            {[
              ['Ders Kodu', ders.kod], ['Ders Adı', ders.ad],
              ['Öğretim Elemanı', c.ogretimElemani], ['E-Posta', c.eposta],
              ['Görüşme Gün/Saat', c.gorusmeGunSaat], ['Ofis', c.ofis],
              ['Dönem', c.donem || ders.yariyil], ['Gün ve Saat', c.gunSaat],
              ['Kredi/AKTS', `${ders.kredi} / ${ders.akts}`], ['Eğitim Dili', c.egitimDili],
              ['Öğretim Türü', c.ogretimTuru], ['Derslik', c.derslik], ['Ders Türü', ders.tur],
              ['Önkoşul Dersleri', c.onkosul], ['Dersin Amacı', c.amac]
            ].map(([label, val]) => (
              <div key={label} className="flex border-b border-slate-100 py-2">
                <span className="w-48 font-black text-blue-900 uppercase text-[10px] tracking-widest">{label}</span>
                <span className="flex-1 font-medium text-slate-700">: {val}</span>
              </div>
            ))}
          </div>

          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">Dersin Öğrenim Çıktıları</h4>
          <table className="w-full border-collapse border border-slate-200 text-[10px]">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="border border-blue-900 p-2 w-8">#</th>
                <th className="border border-blue-900 p-2 text-left">Öğrenim Çıktıları</th>
                <th className="border border-blue-900 p-2 w-12 text-center">Bilgi</th>
                <th className="border border-blue-900 p-2 w-12 text-center">Beceri</th>
                <th className="border border-blue-900 p-2 w-12 text-center">Yetkinlik</th>
              </tr>
            </thead>
            <tbody>
              {(c.ogrenimCiktilari || []).map((oc: any, i: number) => oc.cikti && (
                <tr key={i} className="border-b border-slate-100">
                  <td className="border p-2 text-center font-bold text-slate-400">{i + 1}</td>
                  <td className="border p-2 font-medium text-slate-800">{oc.cikti}</td>
                  <td className="border p-2 text-center">{oc.bilgi ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-200" />}</td>
                  <td className="border p-2 text-center">{oc.beceri ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-200" />}</td>
                  <td className="border p-2 text-center">{oc.yetkinlik ? <CheckSquare className="w-4 h-4 mx-auto text-blue-600" /> : <Square className="w-4 h-4 mx-auto text-slate-200" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SAYFA 2: KAYNAKLAR & POLİTİKALAR */}
        <div className="p-16 border-b border-dashed border-slate-200 page-break-after-always">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">Ders Kaynakları</h4>
          <div className="space-y-6 mb-12 text-sm">
            <div><p className="font-black text-blue-900 mb-2">Temel Ders Kitabı:</p><p className="text-slate-700 italic leading-relaxed">{c.temelKaynaklar}</p></div>
            <div><p className="font-black text-blue-900 mb-2">Yardımcı Kaynaklar:</p><p className="text-slate-700 italic leading-relaxed">{c.yardimciKaynaklar}</p></div>
          </div>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">Ders Politikaları</h4>
          <div className="text-[13px] leading-[1.8] text-slate-700 whitespace-pre-wrap font-medium">{c.politikalar}</div>
        </div>

        {/* SAYFA 3: HAFTALIK İÇERİK & DEĞERLENDİRME */}
        <div className="p-16 border-b border-dashed border-slate-200 page-break-after-always">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">Haftalık Ders İçeriği</h4>
          <table className="w-full border-collapse border border-slate-200 text-[11px] mb-12">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="p-2 w-16">Hafta</th><th className="p-2 text-left">Konu Başlığı</th><th className="p-2 text-left">İlgili Kaynaklar</th><th className="p-2 w-24">İş Yükü</th>
              </tr>
            </thead>
            <tbody>
              {(c.haftalikIcerik || []).map((h: any, i: number) => (
                <tr key={i} className={`border-b ${h.hafta === 'Arasınav' || h.hafta === 'Final' ? 'bg-blue-50 font-black' : ''}`}>
                  <td className="p-2.5 text-center text-blue-900/50">{h.hafta}</td><td className="p-2.5 font-bold text-slate-800">{h.konu}</td><td className="p-2.5 text-slate-500 italic">{h.kaynaklar}</td><td className="p-2.5 text-center">{h.isYuku}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">Ders Değerlendirme</h4>
          <table className="w-full border-collapse border border-slate-200 text-[11px] mb-6">
            <thead><tr className="bg-slate-50"><th>Değerlendirme Türü</th><th>Açıklama</th><th className="w-16">%</th></tr></thead>
            <tbody>
              {(c.degerlendirme || []).map((d: any, i: number) => d.yuzde > 0 && (
                <tr key={i} className="border-b">
                  <td className="p-2.5 font-bold">{d.tur}</td><td className="p-2.5 text-slate-600">{d.aciklama}</td><td className="p-2.5 text-center font-black">{d.yuzde}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs font-black text-blue-900">HARF NOTU BAREMİ: <span className="text-slate-500 font-bold ml-2">{c.harfNotu}</span></p>
        </div>

        {/* SAYFA 4: AKTS & PÇ MATRİS */}
        <div className="p-16 border-b border-dashed border-slate-200 page-break-after-always">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">AKTS - İş Yükü Tablosu</h4>
          <table className="w-full border-collapse border border-slate-200 text-[11px] mb-12">
            <thead><tr className="bg-blue-900 text-white"><th>Etkinlikler</th><th className="w-20">Sayısı</th><th className="w-20">Süresi</th><th className="w-20">Toplam</th></tr></thead>
            <tbody>
              {(c.aktsIsYuku || []).map((row: any, i: number) => row.toplam && (
                <tr key={i} className="border-b"><td className="p-2 font-medium">{row.etkinlik}</td><td className="p-2 text-center">{row.sayisi}</td><td className="p-2 text-center">{row.suresi}</td><td className="p-2 text-center font-black">{row.toplam}</td></tr>
              ))}
            </tbody>
          </table>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">PÇ Matrisi</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-[9px]">
              <thead>
                <tr className="bg-slate-50"><th className="p-1 text-left">PÇ No</th>{Array(10).fill(0).map((_, i) => <th key={i} className="p-1 w-6 text-center">ÖÇ{i+1}</th>)}</tr>
              </thead>
              <tbody>
                {(c.pcMatris || []).map((pc: any, i: number) => (
                  <tr key={i} className="border-b"><td className="p-1 font-black text-blue-900">{pc.id}</td>{(pc.ocValues || []).map((v: any, j: number) => <td key={j} className="p-1 text-center font-bold bg-blue-50/30">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SAYFA 5: DÖÇ MATRİS */}
        <div className="p-16 page-break-after-always">
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-6 bg-blue-50 p-3 border-l-4 border-blue-900">DÖÇ Matrisi</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-[9px]">
              <thead>
                <tr className="bg-slate-50"><th className="p-1 text-left">DÖÇ No</th>{Array(10).fill(0).map((_, i) => <th key={i} className="p-1 w-6 text-center">ÖÇ{i+1}</th>)}</tr>
              </thead>
              <tbody>
                {(c.docMatris || []).map((doc: any, i: number) => (
                  <tr key={i} className="border-b"><td className="p-1 font-black text-blue-900">{doc.id}</td>{(doc.ocValues || []).map((v: any, j: number) => <td key={j} className="p-1 text-center font-bold bg-blue-50/30">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <style>{`@media print { body { background: white !important; } .print\\:hidden { display: none !important; } .page-break-after-always { page-break-after: always; } }`}</style>
    </div>
  );
}
