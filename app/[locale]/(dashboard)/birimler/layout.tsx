import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function BirimlerLayout({
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
  if (!rol.includes('yönetici') && !rol.includes('yonetici') && !rol.includes('admin') && !rol.includes('gözlemci') && !rol.includes('gozlemci')) {
    // Yönetici değilse bu sayfaya girmesi yasak, yönlendir.
    return redirect(`/${locale}/olcutler`);
  }

  return <>{children}</>;
}
