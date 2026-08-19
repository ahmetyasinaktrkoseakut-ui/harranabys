'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { Megaphone, Plus, X, Loader2 } from 'lucide-react';

interface Announcement {
  id: number;
  baslik: string;
  icerik: string;
  olusturulma_tarihi: string;
}

export default function DuyurularClient({ currentUserId, isAdmin }: { currentUserId: string, isAdmin: boolean }) {
  const t = useTranslations('Announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ baslik: '', icerik: '' });

  useEffect(() => {
    async function fetchAnnouncements() {
      const { data, error } = await supabase
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
    
    // Check which ones are not read
    const { data: readData } = await supabase
      .from('duyuru_okumalar')
      .select('duyuru_id')
      .eq('kullanici_id', currentUserId);
    
    const readIds = new Set(readData?.map(r => r.duyuru_id) || []);
    const unreadIds = anns.filter(a => !readIds.has(a.id)).map(a => a.id);

    if (unreadIds.length > 0) {
      const insertData = unreadIds.map(id => ({
        duyuru_id: id,
        kullanici_id: currentUserId,
        okunma_tarihi: new Date().toISOString()
      }));
      await supabase.from('duyuru_okumalar').insert(insertData);
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.baslik.trim() || !newAnnouncement.icerik.trim()) return;

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
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setNewAnnouncement({ baslik: '', icerik: '' });
        setShowModal(false);
        alert(t('save_success'));
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
        {isAdmin && (
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">{t('modal_title')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{t('announcement_title')}</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                  value={newAnnouncement.baslik}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, baslik: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{t('announcement_content')}</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                  value={newAnnouncement.icerik}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, icerik: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('save')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
