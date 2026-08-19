import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DebugPage() {
  const supabase = await createClient();
  let authUser: any = null;
  let profile: any = null;
  let dbError: any = null;
  let activePeriod: any = null;
  let periodError: any = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    authUser = user;

    if (user) {
      const { data, error } = await supabase
        .from('profiller')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      profile = data;
      dbError = error;
    }
  } catch (err: any) {
    dbError = { message: err.message };
  }

  try {
    const { data, error } = await supabase
      .from('donemler')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    activePeriod = data;
    periodError = error;
  } catch (err: any) {
    periodError = { message: err.message };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT DEFINED';

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans bg-white shadow-md rounded-lg mt-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-2">🔍 Sistem Teşhis (Debug) Ekranı</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-indigo-700">1. Supabase Bağlantısı</h2>
          <p className="mt-1">
            <strong>Bağlanılan Supabase Adresi (URL):</strong>{' '}
            <code className="bg-slate-100 px-2 py-1 rounded text-red-600 font-mono text-sm">{supabaseUrl}</code>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            * Eğer bu URL, Supabase panelinizdeki (Urfa) URL ile eşleşmiyorsa, Vercel ortam değişkenleriniz hala Eskişehir'i gösteriyor demektir.
          </p>
        </div>

        <hr />

        <div>
          <h2 className="text-lg font-bold text-indigo-700">2. Aktif Kullanıcı Bilgisi (Auth)</h2>
          {authUser ? (
            <div className="bg-slate-50 p-4 rounded mt-2 text-sm font-mono space-y-1">
              <p><strong>Email:</strong> {authUser.email}</p>
              <p><strong>User ID:</strong> {authUser.id}</p>
            </div>
          ) : (
            <p className="text-red-500 font-semibold mt-2">Giriş yapmış kullanıcı bulunamadı! Lütfen önce giriş yapın.</p>
          )}
        </div>

        <hr />

        <div>
          <h2 className="text-lg font-bold text-indigo-700">3. Veritabanı Profil Sorgusu (profiller Tablosu)</h2>
          {profile ? (
            <div className="bg-slate-50 p-4 rounded mt-2 text-sm font-mono space-y-1">
              <p><strong>Profile Email:</strong> {profile.email}</p>
              <p><strong>Profile ID:</strong> {profile.id}</p>
              <p><strong>Rol:</strong> <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">{profile.rol}</span></p>
              <p><strong>Ad Soyad:</strong> {profile.ad_soyad}</p>
            </div>
          ) : (
            <p className="text-amber-600 font-semibold mt-2">Profil bulunamadı veya RLS engeline takıldı.</p>
          )}
          {dbError && (
            <div className="bg-red-50 text-red-700 p-4 rounded mt-2 text-sm font-mono">
              <strong>Hata Detayı:</strong> {JSON.stringify(dbError)}
            </div>
          )}
        </div>

        <hr />

        <div>
          <h2 className="text-lg font-bold text-indigo-700">4. Aktif Dönem Sorgusu (donemler Tablosu)</h2>
          {activePeriod ? (
            <div className="bg-slate-50 p-4 rounded mt-2 text-sm font-mono space-y-1">
              <p><strong>Aktif Dönem:</strong> {activePeriod.donem_adi}</p>
              <p><strong>Dönem ID:</strong> {activePeriod.id}</p>
            </div>
          ) : (
            <p className="text-red-500 font-semibold mt-2">Aktif dönem (is_active = true) bulunamadı! Sayfanın yüklenememe sebebi budur.</p>
          )}
          {periodError && (
            <div className="bg-red-50 text-red-700 p-4 rounded mt-2 text-sm font-mono">
              <strong>Hata Detayı:</strong> {JSON.stringify(periodError)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
