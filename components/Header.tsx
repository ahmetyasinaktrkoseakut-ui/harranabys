
import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBellClient from './NotificationBellClient';
import PeriodSelectorClient from './PeriodSelectorClient';
import UserProfileWrapper from './UserProfileWrapper';
import ThemeToggleClient from './ThemeToggleClient';

export default async function Header() {
  const supabase = await createClient();
  let userRole = '';
  let userName = '';
  
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiller')
      .select('rol, ad_soyad')
      .eq('id', user.id)
      .maybeSingle();
      
    if (profile) {
      userRole = profile.rol || 'Personel';
      userName = profile.ad_soyad || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
    } else {
      userRole = 'Personel';
      userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
    }
  }

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  const isAdmin = userRole.toLowerCase().includes('yonetici') || userRole.toLowerCase().includes('yönetici') || userRole.toLowerCase().includes('admin');

  const tRoles = await getTranslations('Roles');
  let translatedRole = tRoles('user');
  const roleLower = userRole.toLowerCase();
  
  if (roleLower.includes('admin') && !roleLower.includes('unit')) {
    translatedRole = tRoles('admin');
  } else if (roleLower === 'birimsorumlusu' || roleLower.includes('unit_admin') || roleLower.includes('birim')) {
    translatedRole = tRoles('unit_admin');
  } else if (isAdmin) {
    translatedRole = tRoles('admin');
  } else if (userRole && userRole.trim() !== '') {
    if (roleLower === 'personel' || roleLower === 'user') {
      translatedRole = tRoles('user');
    } else {
      translatedRole = userRole; 
    }
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-8 z-10 sticky top-0">
      <div className="flex items-center gap-5">
        <PeriodSelectorClient />
        <div className="h-4 w-px bg-slate-200"></div>
        <ThemeToggleClient />
        <div className="h-4 w-px bg-slate-200"></div>
        <LanguageSwitcher />
        <div className="h-4 w-px bg-slate-200"></div>
        {user && <NotificationBellClient userId={user.id} isAdmin={isAdmin} />}

        
        <div className="h-6 w-px bg-slate-200"></div>
        
        {user && (
          <UserProfileWrapper 
            userId={user.id}
            userName={userName}
            initials={initials}
            translatedRole={translatedRole}
          />
        )}
      </div>
    </header>
  );
}
