'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  const t = useTranslations('Navigation')


  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-slate-800/50 rounded-xl cursor-pointer transition-all text-red-400 hover:text-red-300">
      <LogOut className="w-5 h-5" />
      <span className="text-sm font-medium">{t('logout')}</span>
    </button>
  )
}
