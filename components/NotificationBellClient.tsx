'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';

const getAsamaSlug = (asama: string) => {
  if (!asama) return 'kontrol-etme';
  const lower = asama.toLowerCase();
  const map: Record<string, string> = {
    'kalite_el_kitabi': 'kalite-el-kitabi',
    'planlama': 'planlama',
    'uygulama': 'uygulama',
    'kontrol': 'kontrol-etme',
    'onlem': 'iyilestirme',
    'önlem': 'iyilestirme',
    'olgunluk': 'olgunluk',
    'rapor': 'ozdegerlendirme'
  };
  return map[lower] || lower;
};

export default function NotificationBellClient({ userId, isAdmin }: { userId: string, isAdmin: boolean }) {
  const t = useTranslations('Header');
  const nt = useTranslations('Notifications');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { selectedPeriod } = usePeriod();

  useEffect(() => {
    let allowedAltOlcutIds: string[] = [];
    
    const fetchNotifications = async () => {
      if (!selectedPeriod) return;
      try {
        if (isAdmin) {
          const { data } = await supabase
            .from('puko_degerlendirmeleri')
            .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
            .eq('durum', 'Beklemede')
            .eq('donem_id', selectedPeriod.id)
            .order('olusturulma_tarihi', { ascending: false })
            .limit(5);
            
          if (data) processNotifications(data);
        } else {
          // Personel için atanmış ölçütleri al
          const { data: atamalar } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('alt_olcut_id')
            .eq('user_id', userId)
            .eq('donem_id', selectedPeriod.id);
            
          if (atamalar && atamalar.length > 0) {
            allowedAltOlcutIds = atamalar.map(a => a.alt_olcut_id);
            const { data } = await supabase
              .from('puko_degerlendirmeleri')
              .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
              .in('alt_olcut_id', allowedAltOlcutIds)
              .eq('donem_id', selectedPeriod.id)
              .in('durum', ['Onaylandı', 'Reddedildi'])
              .order('olusturulma_tarihi', { ascending: false })
              .limit(5);
              
            if (data) processNotifications(data);
          }
        }
      } catch (error) {
        console.error("Bildirimler çekilemedi:", error);
      }
    };

    fetchNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('public:puko_degerlendirmeleri')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puko_degerlendirmeleri' }, (payload) => {
        // Yeni bir değişiklik olduğunda unread sayısını arttırmak için fetch tetikle
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isAdmin, selectedPeriod]);

  const processNotifications = (data: any[]) => {
    // Ölçüt bazlı tekilleştir (Bildirimler sayfası ile tutarlı olması için)
    const uniqueData = Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values());
    setNotifications(uniqueData);
    
    // Unread count mantığı (LocalStorage ile)
    const lastSeen = localStorage.getItem('lastSeenNotifications');
    const lastSeenTime = lastSeen ? parseInt(lastSeen) : 0;
    
    const unread = data.filter(item => {
      const itemTime = new Date(item.olusturulma_tarihi || item.created_at).getTime();
      return itemTime > lastSeenTime;
    });
    
    setUnreadCount(unread.length);
  };

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Menü açıldığında "görüldü" olarak işaretle
      localStorage.setItem('lastSeenNotifications', Date.now().toString());
      setUnreadCount(0);
    }
  };

  const goToBildirimler = () => {
    setIsOpen(false);
    router.push('/bildirimler');
  };

  // Tıklama dışı kapatma
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleBellClick}
        className="relative text-slate-500 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-slate-100"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white px-1 shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">{t('notifications')}</h3>
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">{t('latest')}</span>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                {nt('table.no_data')}
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} 
                     onClick={() => {
                       setIsOpen(false);
                       router.push(`/olcutler/${notif.alt_olcut_id}/${getAsamaSlug(notif.puko_asamasi)}`);
                     }}
                     className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                      {notif.alt_olcutler?.kod || 'Kriter'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${
                      notif.durum === 'Onaylandı' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                      notif.durum === 'Reddedildi' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                      'bg-amber-50 text-amber-700 ring-amber-600/20'
                    }`}>
                      {notif.durum === 'Onaylandı' ? nt('status.approved') : 
                       notif.durum === 'Reddedildi' ? nt('status.rejected') : 
                       nt('status.pending')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                    {isAdmin ? t('new_evidence_submitted') : 
                      notif.durum === 'Reddedildi' ? notif.red_nedeni :
                      notif.durum === 'Onaylandı' ? nt('status.approved') : nt('status.pending')}
                  </p>
                </div>
              ))
            )}
          </div>
          
          <div className="p-2 bg-slate-50 border-t border-slate-100">
            <button 
              onClick={goToBildirimler}
              className="w-full py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-center"
            >
              {t('view_all')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
