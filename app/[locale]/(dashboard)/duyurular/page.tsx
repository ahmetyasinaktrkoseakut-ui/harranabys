import { createClient } from '@/lib/supabase/server';
import DuyurularClient from '@/components/DuyurularClient';
import { redirect } from 'next/navigation';

export default async function DuyurularPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiller')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.rol?.toLowerCase().includes('yonetici') || profile?.rol?.toLowerCase().includes('yönetici') || profile?.rol?.toLowerCase().includes('admin');

  return <DuyurularClient currentUserId={user.id} isAdmin={!!isAdmin} />;
}
