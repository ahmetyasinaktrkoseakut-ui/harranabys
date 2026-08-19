'use client';
// DEFINITIVE SCHEMA FIX: 2026-05-09 19:04

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import BildirimlerTableClient from '@/components/BildirimlerTableClient';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { getAssignedLetter } from '@/lib/utils';

export default function BildirimlerPage() {
  const t = useTranslations('Notifications');
  const { selectedPeriod } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPeriod) return;
      setIsLoading(true);
      setErrorStatus(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = (profile?.rol || '').toLowerCase().trim();
        
        const isUserAdmin = role.includes('yonetici') || role.includes('admin') || role.includes('yönetici');
        
        const { count: coordCount } = await supabase.from('baslik_koordinatorleri').select('*', { count: 'exact', head: true }).eq('kullanici_id', user.id);
        const isUserCoordinator = !isUserAdmin && (coordCount || 0) > 0;
        
        setIsAdmin(isUserAdmin || isUserCoordinator); 

        if (isUserAdmin) {
          const { data } = await supabase
            .from('puko_degerlendirmeleri')
            .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
            .eq('durum', 'Beklemede')
            .eq('donem_id', selectedPeriod.id)
            .order('olusturulma_tarihi', { ascending: false });
          setNotifications(data ? Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values()) : []);
        } else if (isUserCoordinator) {
          const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id);
          
          if (!coordData || coordData.length === 0) {
            setErrorStatus('Koordinatör kaydınız bulunamadı!');
          } else {
            const assignedLetter = getAssignedLetter(coordData[0]?.baslik);
            if (!assignedLetter) {
              setErrorStatus(`Başlık eşleşmedi: ${coordData[0].baslik}`);
            } else {
              const { data: tumOlcutler } = await supabase.from('alt_olcutler').select('id, kod');
              const allowedIds = (tumOlcutler || []).filter(o => o.kod && o.kod.startsWith(assignedLetter)).map(o => o.id);

              if (allowedIds.length > 0) {
                const { data } = await supabase
                  .from('puko_degerlendirmeleri')
                  .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
                  .in('alt_olcut_id', allowedIds)
                  .eq('durum', 'Beklemede')
                  .eq('donem_id', selectedPeriod.id);
                setNotifications(data ? Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values()) : []);
              }
            }
          }
        }
      } catch (err) {
        console.error("Notifications error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedPeriod]);

  if (isLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">{t('title')}</h2>
      {errorStatus && (
        <div className="mb-6 p-6 bg-red-600 text-white rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-8 h-8" />
          <p className="font-bold">{errorStatus}</p>
        </div>
      )}
      <BildirimlerTableClient initialData={notifications} isApprover={isAdmin} />
    </div>
  );
}
