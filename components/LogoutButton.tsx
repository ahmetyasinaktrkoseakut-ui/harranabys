'use client'

import { supabase } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const t = useTranslations('Navigation')
  const locale = useLocale()

  const handleLogout = async () => {
    try {
      // 1. İstemci taraflı Supabase oturumunu kapat
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Client signOut error:', e)
    }

    try {
      // 2. Sunucu taraflı oturum kapatma ve sb-* çerez temizliği
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.warn('Server logout error:', e)
    }

    // 3. Tarayıcı yerel durumunu temizle
    try {
      localStorage.removeItem('lastActivity')
      sessionStorage.removeItem('sb-session-active')
    } catch (_) {}

    // 4. İlgili locale ile login sayfasına tam sayfa yönlendir
    const targetLocale = locale || 'tr'
    window.location.href = `/${targetLocale}/login`
  }

  return (
    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-slate-800/50 rounded-xl cursor-pointer transition-all text-red-400 hover:text-red-300">
      <LogOut className="w-5 h-5" />
      <span className="text-sm font-medium">{t('logout')}</span>
    </button>
  )
}
