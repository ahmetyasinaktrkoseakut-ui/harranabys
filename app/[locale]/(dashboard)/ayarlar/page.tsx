import { createClient } from '@/lib/supabase/server';
import { User, Settings as SettingsIcon, Mail, ShieldAlert, KeyRound } from 'lucide-react';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AyarlarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile role
  const { data: profile } = await supabase
    .from('profiller')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  let roleLabel = 'Kullanıcı';
  if (profile?.rol) {
    if (profile.rol === 'BirimSorumlusu') {
      roleLabel = 'Birim Sorumlusu';
    } else if (profile.rol.toLowerCase().includes('yonetici') || profile.rol.toLowerCase().includes('yönetici') || profile.rol.toLowerCase().includes('admin')) {
      roleLabel = 'Sistem Yöneticisi';
    } else {
      roleLabel = profile.rol;
    }
  }

  return (
    <div className="p-8 max-w-[800px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          Hesap Ayarları
        </h2>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Sistem üzerindeki yetki sınırlarınızı ve hesap bilgilerinizi buradan görüntüleyebilirsiniz. Kimlik bilgilerinizi güvenli tutun.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden relative">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700 w-full"></div>
        
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="w-24 h-24 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 flex items-center justify-center">
              <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center">
                <User className="w-10 h-10 text-blue-600" />
              </div>
            </div>
            
            <span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold border border-blue-200 shadow-sm flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> 
              Yetki Seviyesi: {roleLabel}
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Personel Profili</h3>
              <p className="text-sm text-slate-500 mt-1">BKY Sistemi oturum bilgileriniz.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-600">E-Posta Adresi</span>
                </div>
                <p className="text-slate-800 font-medium pl-11">{user.email}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <KeyRound className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-600">Kullanıcı Kimliği</span>
                </div>
                <p className="text-slate-800 font-medium font-mono text-xs pl-11 truncate" title={user.id}>{user.id}</p>
              </div>
            </div>
            
            <div className="pt-6 border-t border-slate-100 mt-8 flex justify-end">
              <div className="w-48">
                <LogoutButton />
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
