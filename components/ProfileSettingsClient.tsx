'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User, Save, Loader2, X } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function ProfileSettingsClient({ 
  userId, 
  initialName, 
  isOpen, 
  onClose 
}: { 
  userId: string; 
  initialName: string; 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const [name, setName] = useState(initialName || '');
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations('Header');
  const router = useRouter();

  useEffect(() => {
    setName(initialName || '');
  }, [initialName]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiller')
        .update({ ad_soyad: name.trim() })
        .eq('id', userId);

      if (error) throw error;
      
      // Update auth metadata too
      await supabase.auth.updateUser({
        data: { full_name: name.trim() }
      });

      alert("Profil başarıyla güncellendi.");
      onClose();
      router.refresh();
    } catch (error: any) {
      console.error("Profil güncelleme hatası:", error);
      alert("Hata: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Profil Ayarları</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Ad Soyad</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınız ve Soyadınız"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-slate-600 font-bold hover:text-slate-800 transition-colors"
          >
            Vazgeç
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !name.trim() || name === initialName}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
