'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Building2, 
  Calendar, 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  User, 
  Mail, 
  Tag, 
  Layers, 
  HelpCircle,
  FileCheck,
  ShieldCheck
} from 'lucide-react';
import Image from 'next/image';

const FAALIYET_TURLERI = [
  'Konferans / Kongre / Sempozyum',
  'Panel / Söyleşi / Seminer',
  'Çalıştay / Kurs / Eğitim Programı',
  'Sosyal Sorumluluk / Toplumsal Katkı Faaliyeti',
  'Proje / Araştırma / Yayın Çalışması',
  'Öğrenci Etkinliği / Kulüp Faaliyeti',
  'Kurumlararası İş Birliği / Protokol',
  'Diğer Faaliyetler'
];

interface AnaBaslik {
  id: number;
  kod: string;
  baslik_adi: string;
}

interface AltOlcut {
  id: number;
  kod: string;
  olcut_adi: string;
  ana_baslik_id: number;
}

export default function FaaliyetBildirimiPage() {
  const [adSoyad, setAdSoyad] = useState('');
  const [email, setEmail] = useState('');
  const [faaliyetTuru, setFaaliyetTuru] = useState('');
  const [faaliyetAdi, setFaaliyetAdi] = useState('');
  const [duzenleyenKurum, setDuzenleyenKurum] = useState('');
  const [faaliyetTarihi, setFaaliyetTarihi] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [selectedAnaBaslikId, setSelectedAnaBaslikId] = useState<number | ''>('');
  const [selectedAltOlcutId, setSelectedAltOlcutId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [honeypot, setHoneypot] = useState('');

  const [anaBasliklar, setAnaBasliklar] = useState<AnaBaslik[]>([]);
  const [altOlcutler, setAltOlcutler] = useState<AltOlcut[]>([]);
  const [activePeriodName, setActivePeriodName] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadFormData() {
      try {
        setInitialLoading(true);

        const res = await fetch('/api/faaliyet-bildirimi');
        if (res.ok) {
          const json = await res.json();
          if (json.activePeriod) {
            const pName = (json.activePeriod.donem_adi || '').trim();
            setActivePeriodName(pName);
          }
          if (Array.isArray(json.anaBasliklar)) setAnaBasliklar(json.anaBasliklar);
          if (Array.isArray(json.altOlcutler)) setAltOlcutler(json.altOlcutler);
        } else {
          // İstemci taraflı yedek sorgu
          const { data: periodData } = await supabase
            .from('donemler')
            .select('id, donem_adi, is_active')
            .eq('is_active', true)
            .maybeSingle();

          if (periodData) {
            const pName = (periodData.donem_adi || '').trim();
            setActivePeriodName(pName);
          }

          const { data: abData } = await supabase
            .from('ana_basliklar')
            .select('id, kod, baslik_adi')
            .order('id');
          if (abData) setAnaBasliklar(abData);

          const { data: aoData } = await supabase
            .from('alt_olcutler')
            .select('id, kod, olcut_adi, ana_baslik_id')
            .order('id');
          if (aoData) setAltOlcutler(aoData);
        }
      } catch (err) {
        console.error('Veri yükleme hatası:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadFormData();
  }, []);

  const filteredAltOlcutler = selectedAnaBaslikId
    ? altOlcutler.filter(ao => ao.ana_baslik_id === selectedAnaBaslikId)
    : altOlcutler;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!adSoyad.trim() || !faaliyetTuru || !faaliyetAdi.trim() || !faaliyetTarihi || !selectedAltOlcutId || !file) {
      setStatusMessage({ type: 'error', text: 'Lütfen tüm zorunlu alanları doldurun ve kanıt belgenizi ekleyin.' });
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append('adSoyad', adSoyad.trim());
      formData.append('email', email.trim());
      formData.append('faaliyetTuru', faaliyetTuru);
      formData.append('faaliyetAdi', faaliyetAdi.trim());
      formData.append('duzenleyenKurum', duzenleyenKurum.trim());
      formData.append('faaliyetTarihi', faaliyetTarihi);
      formData.append('aciklama', aciklama.trim());
      formData.append('altOlcutId', String(selectedAltOlcutId));
      formData.append('file', file);
      if (honeypot) formData.append('website', honeypot);

      const res = await fetch('/api/faaliyet-bildirimi', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Bildirim iletilirken bir hata oluştu.');
      }

      setStatusMessage({
        type: 'success',
        text: data.message || 'Faaliyetiniz ve kanıt belgeniz başarıyla iletildi.'
      });

      // Formu sıfırla
      setFaaliyetAdi('');
      setDuzenleyenKurum('');
      setFaaliyetTarihi('');
      setAciklama('');
      setFile(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Bir hata oluştu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Üst Kurumsal Başlık Kartı */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center p-2 text-white shadow-md">
              <Building2 className="w-8 h-8 text-sky-400" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
            Dış Faaliyet ve Kanıt Bildirimi
          </h1>
          <h2 className="text-sm sm:text-base font-semibold text-slate-600 mt-1">
            Akreditasyon Bilgi Yönetim Sistemi (ABYS)
          </h2>
          <p className="text-xs sm:text-sm text-indigo-700 font-bold mt-2 bg-indigo-50 inline-block px-3 py-1 rounded-full border border-indigo-200">
            Dış Kanıt Toplama ve Bildirim Formu
          </p>
        </div>

        {/* Başarı / Hata Bildirimi */}
        {statusMessage && (
          <div className={`p-4 rounded-xl mb-6 shadow-sm flex items-start gap-3 border ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-bold">{statusMessage.type === 'success' ? 'Başarılı!' : 'Hata!'}</p>
              <p className="text-xs mt-0.5 leading-relaxed">{statusMessage.text}</p>
            </div>
          </div>
        )}

        {/* Ana Form Kartı */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          
          {/* Honeypot (Bot Tuzağı) */}
          <div className="hidden" aria-hidden="true">
            <input 
              type="text" 
              name="website" 
              tabIndex={-1} 
              autoComplete="off" 
              value={honeypot} 
              onChange={e => setHoneypot(e.target.value)} 
            />
          </div>

          {/* 1. Bölüm: Faaliyeti Yapan Bilgileri */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              1. Faaliyeti Gerçekleştiren Kişi Bilgileri
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ad Soyad (Unvan İle) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Doç. Dr. Ahmet Yılmaz"
                  value={adSoyad}
                  onChange={e => setAdSoyad(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kurumsal E-Posta
                </label>
                <input
                  type="email"
                  placeholder="Örn: hoca@ogu.edu.tr"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* 2. Bölüm: Faaliyet Detayları */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Tag className="w-4 h-4 text-indigo-600" />
              2. Faaliyetin Türü ve Tanımı
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Faaliyet Türü <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={faaliyetTuru}
                    onChange={e => setFaaliyetTuru(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white transition-colors"
                  >
                    <option value="">-- Faaliyet Türünü Seçiniz --</option>
                    {FAALIYET_TURLERI.map(tur => (
                      <option key={tur} value={tur}>{tur}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Faaliyet Tarihi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={faaliyetTarihi}
                    onChange={e => setFaaliyetTarihi(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Faaliyetin Tam Adı / Başlığı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Uluslararası İslam Medeniyeti Sempozyumu Bildirisi"
                  value={faaliyetAdi}
                  onChange={e => setFaaliyetAdi(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Düzenleyen Kurum / Paydaş Kuruluş
                </label>
                <input
                  type="text"
                  placeholder="Örn: Diyanet İşleri Başkanlığı, TÜBİTAK, vb."
                  value={duzenleyenKurum}
                  onChange={e => setDuzenleyenKurum(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Faaliyet Açıklaması / Kısa Özet
                </label>
                <textarea
                  rows={2}
                  placeholder="Faaliyetin içeriği ve akreditasyon sürecine katkısına dair 1-2 cümlelik kısa özet..."
                  value={aciklama}
                  onChange={e => setAciklama(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* 3. Bölüm: Akreditasyon Ölçütü Eşleştirmesi */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              3. İlgili Komisyon ve Ölçüt Eşleştirmesi
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  İlgili Komisyon / Ana Başlık <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedAnaBaslikId}
                  onChange={e => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : '';
                    setSelectedAnaBaslikId(val);
                    setSelectedAltOlcutId('');
                  }}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white transition-colors"
                >
                  <option value="">-- Komisyon Seçiniz --</option>
                  {anaBasliklar.map(ab => (
                    <option key={ab.id} value={ab.id}>
                      {ab.kod} - {ab.baslik_adi}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alt Ölçüt <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  disabled={!selectedAnaBaslikId}
                  value={selectedAltOlcutId}
                  onChange={e => setSelectedAltOlcutId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white transition-colors disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">-- Ölçüt Seçiniz --</option>
                  {filteredAltOlcutler.map(ao => (
                    <option key={ao.id} value={ao.id}>
                      {ao.kod} - {ao.olcut_adi}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Bölüm: Kanıt Belgesi Yükleme */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              4. Faaliyet Kanıt Belgesi (PDF, Görsel, Word)
            </h3>

            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center bg-slate-50/50 transition-colors">
              <input
                type="file"
                id="file-upload"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <UploadCloud className="w-10 h-10 text-indigo-600 mb-2" />
                <span className="text-sm font-bold text-slate-900">
                  {file ? file.name : 'Dosya seçmek için tıklayın veya sürükleyip bırakın'}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  PDF, Word, Excel veya Görsel formatları (Maksimum 15 MB)
                </span>
                {file && (
                  <span className="text-xs font-semibold text-emerald-600 mt-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    Seçildi: {Math.round(file.size / 1024)} KB
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* KVKK ve İAA Bilgilendirme Notu */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-slate-500 text-xs leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              Bildirdiğiniz bilgiler ve ekli belgeler, 6698 sayılı KVKK kapsamında yalnızca fakültenin <strong>İlahiyat Akreditasyon Ajansı (İAA)</strong> akreditasyon süreçleri ve kurumsal faaliyet kanıt havuzunda değerlendirilmek üzere işlenmektedir.
            </span>
          </div>

          {/* Gönder Butonu */}
          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  Faaliyeti ve Kanıtı Sisteme Gönder
                </>
              )}
            </button>
          </div>

        </form>

        {/* Alt Bilgi */}
        <p className="text-center text-xs text-slate-500 mt-6">
          &copy; {new Date().getFullYear()} Akreditasyon Bilgi Yönetim Sistemi (ABYS)
        </p>

      </div>
    </div>
  );
}
