import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
  const isAdmin = profile?.rol?.toLowerCase().includes('admin') || profile?.rol?.toLowerCase().includes('yönetici') || profile?.rol?.toLowerCase().includes('yonetici');

  const { count: assignmentCount } = await supabase.from('kullanici_olcut_atamalari').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  const { count: coordCount } = await supabase.from('baslik_koordinatorleri').select('*', { count: 'exact', head: true }).eq('kullanici_id', user.id);
  const isCoordinator = (coordCount || 0) > 0;

  if (!isAdmin && !isCoordinator && (assignmentCount || 0) === 0) {
    redirect('/ders-izlenceleri');
  }

  redirect('/olcutler');
}
