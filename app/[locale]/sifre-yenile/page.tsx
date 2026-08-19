'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { supabase } from '@/lib/supabase/client';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations('Auth');
  const tErrors = useTranslations('Errors');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Check if the user has a valid session to reset the password
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Automatically redirects hash to session if arrived via email link
        // If still no session, maybe token expired or invalid
      }
    };
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: tErrors('default') }); // or a specific "passwords do not match" if needed
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setMessage({ type: 'success', text: t('updateSuccess') });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
      
    } catch (err: any) {
      try {
        const localizedError = tErrors(err.message as any);
        if (localizedError.includes('Errors.')) throw new Error();
        setMessage({ type: 'error', text: localizedError });
      } catch {
        setMessage({ type: 'error', text: tErrors('default') });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-8 text-center">
          <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            {t('newPassword')}
          </h3>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-bold border animate-in slide-in-from-top duration-300 ${
            message.type === 'error' 
              ? 'bg-red-50 text-red-700 border-red-100' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('newPassword')}</label>
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
                placeholder="••••••••"
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

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('newPassword')}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-300 group-focus-within:text-indigo-600" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-sm"
                placeholder="••••••••"
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !password || password !== confirmPassword}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-5 rounded-2xl font-black text-lg transition-all shadow-2xl shadow-indigo-500/40 disabled:opacity-70 disabled:active:scale-100 uppercase tracking-tighter"
            >
              {isSubmitting && <Loader2 className="w-6 h-6 animate-spin" />}
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
