'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { supabase } from '@/lib/supabase/client'
import { Lock, Mail, User, Loader2, Eye, EyeOff, LayoutDashboard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('Auth')
  const tErrors = useTranslations('Errors')
  
  const [isLogin, setIsLogin] = useState(true)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [adSoyad, setAdSoyad] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/olcutler')
        router.refresh()
      } else {
        // SIGN UP
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              ad_soyad: adSoyad,
              full_name: adSoyad // Compatibility
            }
          }
        })

        if (error) throw error

        if (data.user) {
          // GÜVENLİ VERİTABANI SENKRONİZASYONU (API Route üzerinden)
          try {
            const syncRes = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: data.user.id,
                email: data.user.email,
                ad_soyad: adSoyad,
                rol: 'BirimSorumlusu'
              })
            });
            
            if (!syncRes.ok) {
              const syncData = await syncRes.json();
              throw new Error(syncData.error || 'Profil senkronizasyonu başarısız oldu.');
            }
          } catch (syncErr: any) {
            console.error("Senkronizasyon Hatası:", syncErr);
            // Profil oluşturulamazsa oturumu kapat ki hatalı bir auth state oluşmasın
            await supabase.auth.signOut();
            throw syncErr; // Kayıt işlemini durdur ve hatayı göster
          }
        }

        setMessage({ type: 'success', text: t('signup_success') })
        setIsLogin(true)
      }
    } catch (err: any) {
      const errorMessage = err.message || '';
      try {
        const localizedError = tErrors(errorMessage as any);
        if (localizedError.includes('Errors.')) throw new Error();
        setMessage({ type: 'error', text: localizedError });
      } catch {
        setMessage({ type: 'error', text: errorMessage || tErrors('default') });
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/${locale}/sifre-yenile`
      })

      if (error) throw error

      setMessage({ type: 'success', text: t('resetLinkSent') })
    } catch (err: any) {
      try {
        const localizedError = tErrors(err.message as any);
        if (localizedError.includes('Errors.')) throw new Error();
        setMessage({ type: 'error', text: localizedError });
      } catch {
        setMessage({ type: 'error', text: tErrors('default') });
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white font-sans overflow-hidden">
      
      {/* SOL TARAF: FORM ALANI */}
      <div className="flex flex-col items-center justify-center p-8 md:p-16 lg:p-24 animate-in fade-in slide-in-from-left duration-700 relative">
        
        {/* DİL SEÇİCİ - Sağ Üst */}
        <div className="absolute top-8 right-8">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-md">
          
          {/* Logo ve Başlık */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight uppercase">
                {t('system_name')}
              </h1>
              <h2 className="text-lg font-bold text-slate-500 leading-tight">
                {t('system_subname')}
              </h2>
            </div>
          </div>

          {/* Karşılama Metni */}
          <div className="mb-10">
            <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              {isForgotPassword ? t('forgotPassword') : (isLogin ? t('login_title') : t('signup_title'))}
            </h3>
            <p className="text-slate-500 font-medium">
              {isForgotPassword ? '' : (isLogin ? t('login_desc') : t('signup_desc'))}
            </p>
          </div>

          {message && (
            <div className={`mb-8 p-4 rounded-2xl text-sm font-bold border animate-in slide-in-from-top duration-300 ${
              message.type === 'error' 
                ? 'bg-red-50 text-red-700 border-red-100' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              {message.text}
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('email')}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-300 group-focus-within:text-indigo-600" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-sm"
                    placeholder={t('email_placeholder')}
                  />
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-5 rounded-2xl font-black text-lg transition-all shadow-2xl shadow-indigo-500/40 disabled:opacity-70 disabled:active:scale-100 uppercase tracking-tighter"
                >
                  {isSubmitting && <Loader2 className="w-6 h-6 animate-spin" />}
                  {t('forgotPassword')}
                </button>
              </div>

              <div className="mt-6 text-center">
                <button 
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-slate-500 font-bold hover:text-indigo-600 transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-5">
              
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('full_name')}</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                      <User className="h-5 w-5 text-slate-300 group-focus-within:text-indigo-600" />
                    </div>
                    <input
                      type="text"
                      required
                      value={adSoyad}
                      onChange={(e) => setAdSoyad(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-sm"
                      placeholder={t('full_name_placeholder')}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('email')}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-300 group-focus-within:text-indigo-600" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-sm"
                    placeholder={t('email_placeholder')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end pr-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('password')}</label>
                  {isLogin && <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">{t('forgot_password')}</button>}
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-300 group-focus-within:text-indigo-600" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-sm"
                    placeholder={t('password_placeholder')}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-5 rounded-2xl font-black text-lg transition-all shadow-2xl shadow-indigo-500/40 disabled:opacity-70 disabled:active:scale-100 uppercase tracking-tighter"
                >
                  {isSubmitting && <Loader2 className="w-6 h-6 animate-spin" />}
                  {isLogin ? t('login_button') : t('signup_button')}
                </button>
              </div>
            </form>
          )}

          {!isForgotPassword && (
            <div className="mt-10 text-center">
              <p className="text-slate-500 font-bold">
                {isLogin ? t('no_account') : t('have_account')}
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 text-indigo-600 hover:text-indigo-700 underline underline-offset-4 decoration-2"
                >
                  {isLogin ? t('signup_link') : t('login_link')}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SAĞ TARAF: GÖRSEL ALAN */}
      <div className="hidden md:block relative overflow-hidden group">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[10s] group-hover:scale-110"
          style={{ backgroundImage: "url('/login_illustration_1778194858641.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 to-slate-900/80 backdrop-blur-[2px]" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-16 text-center">
          <div className="max-w-lg space-y-8">
            <div className="w-24 h-2 w-px bg-white/20 mx-auto mb-8"></div>
            <h4 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tighter drop-shadow-2xl">
              {t('quote')}
            </h4>
            <div className="flex items-center justify-center gap-4 pt-8">
              <div className="h-px w-12 bg-white/30"></div>
              <span className="text-white/60 font-bold text-sm tracking-widest uppercase">{t('quality_system')}</span>
              <div className="h-px w-12 bg-white/30"></div>
            </div>
          </div>
        </div>

        {/* Dekoratif Elementler */}
        <div className="absolute bottom-10 right-10 flex gap-3">
          <div className="w-3 h-3 rounded-full bg-white/20"></div>
          <div className="w-3 h-3 rounded-full bg-white/50"></div>
          <div className="w-3 h-3 rounded-full bg-white/20"></div>
        </div>
      </div>
    </div>
  )
}
