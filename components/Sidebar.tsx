import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import SidebarNavClient from './SidebarNavClient';

export default async function Sidebar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role = '';
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();
      
    if (profile) {
      role = profile.rol;
    }
  }

  const isAdmin = role.toLowerCase().includes('yonetici') || role.toLowerCase().includes('yönetici') || role.toLowerCase().includes('admin');
  const isObserver = role.toLowerCase().includes('gözlemci') || role.toLowerCase().includes('gozlemci');

  // Ölçüt ataması var mı kontrol et
  let hasAssignment = false;
  let isCoordinator = false;
  if (user) {
    const { count } = await supabase
      .from('kullanici_olcut_atamalari')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    hasAssignment = (count || 0) > 0;

    const { count: coordCount } = await supabase
      .from('baslik_koordinatorleri')
      .select('*', { count: 'exact', head: true })
      .eq('kullanici_id', user.id);
    isCoordinator = (coordCount || 0) > 0;
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800/50 shadow-2xl">
      <div className="p-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 transform -rotate-3">
          <BookOpen className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-sm font-black text-white leading-tight tracking-tight uppercase">Akreditasyon</h1>
          <h2 className="text-[11px] font-bold text-slate-400 leading-tight uppercase tracking-[0.2em]">Sistemi</h2>
        </div>
      </div>

      <SidebarNavClient isAdmin={isAdmin} isObserver={isObserver} userId={user?.id || ''} hasAssignment={hasAssignment} isCoordinator={isCoordinator} />
    </aside>
  );
}
