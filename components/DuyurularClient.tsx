'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { Megaphone, Plus, X, Loader2, Users, BookOpen, User } from 'lucide-react';

interface Announcement {
  id: number;
  baslik: string;
  icerik: string;
  olusturulma_tarihi: string;
}

interface HeadingItem {
  id: number;
  kod: string;
  baslik_adi: string;
}

interface InstructorItem {
  id: string;
  ad_soyad: string;
  email: string;
}

interface DuyurularClientProps {
  currentUserId: string;
  isAdmin: boolean;
  isCoordinator?: boolean;
  canCreate?: boolean;
  headings?: HeadingItem[];
  instructors?: InstructorItem[];
}

export default function DuyurularClient({
  currentUserId,
  isAdmin,
  isCoordinator = false,
  canCreate = false,
  headings = [],
  instructors = [],
}: DuyurularClientProps) {
  const t = useTranslations('Announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ baslik: '', icerik: '' });
  const [sendEmail, setSendEmail] = useState(false);

  // Hedef Kitle Durumu: 'tum' (Tüm Fakülte), 'baslik' (Başlığa Göre), 'hoca' (Tek Bir Hoca)
  const [hedefKitle, setHedefKitle] = useState<'tum' | 'baslik' | 'hoca'>(
    isAdmin ? 'tum' : 'baslik'
  );
  const [hedefBaslikKod, setHedefBaslikKod] = useState<string>(headings[0]?.kod || 'A');
  const [hedefHocaId, setHedefHocaId] = useState<string>('');

  useEffect(() => {
    if (headings.length > 0 && !headings.some(h => h.kod === hedefBaslikKod)) {
      setHedefBaslikKod(headings[0].kod);
    }
  }, [headings]);

  useEffect(() => {
    async function fetchAnnouncements() {
      const { data } = await supabase
        .from('duyurular')
        .select('*')
        .order('olusturulma_tarihi', { ascending: false });
      if (data) {
        setAnnouncements(data);
        markAsRead(data);
      }
    }
    fetchAnnouncements();

    const channel = supabase
      .channel('duyurular_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'duyurular' },
        (payload) => {
          const newAnn = payload.new as Announcement;
          setAnnouncements((prev) => [newAnn, ...prev]);
          markAsRead([newAnn]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const markAsRead = async (anns: Announcement[]) => {
    if (anns.length === 0) return;

    const { data: readData } = await supabase
      .from('duyuru_okumalar')
      .select('duyuru_id')
      .eq('kullanici_id', currentUserId);

    const readIds = new Set(readData?.map((r) => r.duyuru_id) || []);
    const unreadIds = anns.filter((a) => !readIds.has(a.id)).map((a) => a.id);

    if (unreadIds.length > 0) {
      const insertData = unreadIds.map((id) => ({
        duyuru_id: id,
        kullanici_id: currentUserId,
        okunma_tarihi: new Date().toISOString(),
      }));
      await supabase.from('duyuru_okumalar').insert(insertData);
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.baslik.trim() || !newAnnouncement.icerik.trim()) return;

    if (hedefKitle === 'hoca' && !hedefHocaId) {
      alert('Lütfen duyuru gönderilecek öğretim elemanını seçiniz.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/duyurular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baslik: newAnnouncement.baslik.trim(),
          icerik: newAnnouncement.icerik.trim(),
          sendEmail,
          hedefKitle,
          hedefBaslikKod,
          hedefHocaId: hedefKitle === 'hoca' ? hedefHocaId : undefined,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setNewAnnouncement({ baslik: '', icerik: '' });
        setSendEmail(hedefKitle !== 'tum');
        setHedefHocaId('');
        setShowModal(false);
        let msg = '';
        if (result.isPrivate) {
          msg = result.emailSent
            ? `Özel bildirim ve e-posta (${result.recipientCount || 0} kişi) başarıyla iletildi.`
            : 'Özel bildirim başarıyla iletildi (genel panoda görünmez).';
        } else {
          msg = result.emailSent
            ? `Duyuru panoya eklendi ve tüm hocalara (${result.recipientCount || 0} kişi) e-posta gönderildi.`
            : 'Duyuru başarıyla genel panoya kaydedildi.';
        }
        alert(msg);
      } else {
        alert(result.error || 'Duyuru kaydedilirken bir hata oluştu.');
      }
    } catch (err: any) {
      console.error('Add announcement error:', err);
      alert(err.message || 'Duyuru gönderilirken bağlantı hatası oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowCreate = canCreate || isAdmin || isCoordinator;

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-blue-600" />
            {t('title')}
          </h1>
          <p className="text-slate-500 mt-2">{t('description')}</p>
        </div>
        {allowCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-5 h-5" />
            {t('add_new')}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {announcements.length > 0 ? (
          announcements.map((ann) => (
            <div key={ann.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-slate-800">{ann.baslik}</h3>
                <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  {ann.olusturulma_tarihi ? new Date(ann.olusturulma_tarihi).toLocaleDateString() : ''}
                </span>
              </div>
              <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">{ann.icerik}</div>
            </div>
          ))
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400">
            <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>{t('no_announcements')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-800">{t('modal_title')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddAnnouncement} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Hedef Kitle Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Hedef Kitle / Kime Gönderilsin?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setHedefKitle('tum');
                        setSendEmail(false);
                      }}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        hedefKitle === 'tum'
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Users className="w-4 h-4 mb-1" />
                      Tüm Fakülte
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setHedefKitle('baslik');
                      setSendEmail(true);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      hedefKitle === 'baslik'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 mb-1" />
                    Başlığa Göre
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHedefKitle('hoca');
                      setSendEmail(true);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      hedefKitle === 'hoca'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <User className="w-4 h-4 mb-1" />
                    Kişiye Özel
                  </button>
                </div>
              </div>

              {/* Başlık Seçimi Dropdown */}
              {hedefKitle === 'baslik' && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Hangi Başlığın Sorumlularına?
                  </label>
                  <select
                    value={hedefBaslikKod}
                    onChange={(e) => setHedefBaslikKod(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {headings.map((h) => (
                      <option key={h.kod} value={h.kod}>
                        [{h.kod}] {h.baslik_adi}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Kişi / Hoca Seçimi Dropdown */}
              {hedefKitle === 'hoca' && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Öğretim Elemanı Seçiniz
                  </label>
                  <select
                    value={hedefHocaId}
                    onChange={(e) => setHedefHocaId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Öğretim Elemanı Seçiniz --</option>
                    {instructors.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.ad_soyad} ({ins.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{t('announcement_title')}</label>
                <input
                  type="text"
                  required
                  placeholder="Duyuru başlığını yazınız..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  value={newAnnouncement.baslik}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, baslik: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{t('announcement_content')}</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Duyuru içeriğini giriniz..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  value={newAnnouncement.icerik}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, icerik: e.target.value })}
                />
              </div>

              {/* E-Posta Gönderim Onay Kutusu */}
              <div className="flex flex-col gap-1 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="sendEmailCheckbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    {hedefKitle === 'tum'
                      ? 'Bu duyuruyu öğretim elemanlarına e-posta ile de bildir'
                      : 'Bu bildirimi e-posta ile ilet'}
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 pl-6.5 mt-0.5">
                  {hedefKitle === 'tum' &&
                    (sendEmail
                      ? 'Duyuru genel panoya eklenecek ve tüm fakülte öğretim elemanlarına resmi e-posta da gönderilecektir.'
                      : 'Yalnızca sistem içi genel duyuru panosuna eklenecektir (e-posta gönderilmez).')}
                  {hedefKitle === 'baslik' &&
                    (sendEmail
                      ? `[${hedefBaslikKod}] başlığındaki hocalara doğrudan e-posta ve dahili bildirim iletilecektir (genel panoda görünmez).`
                      : `Yalnızca [${hedefBaslikKod}] başlığındaki hocalara dahili bildirim iletilir (e-posta gönderilmez).`)}
                  {hedefKitle === 'hoca' &&
                    (sendEmail
                      ? 'Yalnızca seçilen öğretim elemanının e-posta adresine ve bildirim paneline iletilecektir (genel panoda görünmez).'
                      : 'Yalnızca seçilen öğretim elemanının bildirim paneline iletilir (e-posta gönderilmez).')}
                </p>
              </div>

              <div className="pt-2 flex-shrink-0">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
