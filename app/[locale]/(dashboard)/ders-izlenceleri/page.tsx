import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DersIzlencesiClient from '@/components/DersIzlencesiClient';

export const dynamic = 'force-dynamic';

export default async function DersIzlenceleriPage({ searchParams }: { searchParams: Promise<{ kod?: string }> }) {
  const { kod } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!kod) redirect('/izlenceler');

  const { data: dersler } = await supabase
    .from('dersler')
    .select('*')
    .order('yariyil')
    .order('kod');

  // Profilden ad ve rol bilgisini al (Daha güvenli fetch)
  const { data: profileData } = await supabase
    .from('profiller')
    .select('*')
    .eq('id', user.id);
  const profile = profileData?.[0];

  const { data: authUser } = await supabase.auth.getUser();
  const email = authUser.user?.email?.toLowerCase() || '';

  // Yetki Kontrolü: 
  // 1. Yönetici veya Birim Sorumlusu ise doğrudan izin ver
  // 2. @harran.edu.tr e-posta uzantılı öğretim elemanı ise ölçüt almasa bile izlence doldurabilsin
  const userRole = (profile?.rol || user.user_metadata?.role || '').toLowerCase();
  // Daha kapsayıcı Regex kontrolü (Türkçe karakter ve farklı yazım türleri için)
  const isYonetici = /admin|yonetici|yönetici|manager/i.test(userRole) || user.user_metadata?.isAdmin === true;
  const isBirimSorumlusu = /birim/i.test(userRole);
  const isHarranTeacher = email.endsWith('@harran.edu.tr') || email.includes('harran.edu.tr');

  if (!isYonetici && !isBirimSorumlusu && !isHarranTeacher) {
    // Yetkisi yoksa genel izlenceler (sadece görüntüleme) sayfasına yönlendir
    redirect(`/izlenceler/${kod}`);
  }

  // İzlenceleri çek: 
  // Eğer yönetici ise tüm izlenceleri görsün (başkalarınınkine bakabilsin), 
  // personel ise sadece kendisininkini görsün.
  let izlenceQuery = supabase
    .from('ders_izlenceleri')
    .select('id, ders_id, guncelleme_tarihi, icerik, hoca_id');
  
  if (!isYonetici) {
    izlenceQuery = izlenceQuery.eq('hoca_id', user.id);
  }

  const { data: izlenceler } = await izlenceQuery;

  return (
    <DersIzlencesiClient
      dersler={dersler || []}
      izlenceler={izlenceler || []}
      currentUserId={user.id}
      defaultOgretimElemani={profile?.tam_adi || ''}
      defaultEposta={email}
    />
  );
}
