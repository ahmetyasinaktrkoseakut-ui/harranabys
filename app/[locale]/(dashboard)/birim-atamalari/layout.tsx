import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function birimatamalariLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase
    .from('profiller')
    .select('rol')
    .eq('id', user.id)
    .single();

  const rol = profile?.rol?.toLowerCase() || '';
  const isAdmin = rol.includes('yönetici') || rol.includes('yonetici') || rol.includes('admin') || rol.includes('gözlemci') || rol.includes('gozlemci');
  
  if (!isAdmin) {
    // Koordinatör mü kontrol et
    const { count } = await supabase
      .from('baslik_koordinatorleri')
      .select('*', { count: 'exact', head: true })
      .eq('kullanici_id', user.id);
    
    if ((count || 0) === 0) {
      // Ne yönetici ne koordinatör, yasakla.
      return redirect(`/${locale}/olcutler`);
    }
  }

  return <>{children}</>;
}
