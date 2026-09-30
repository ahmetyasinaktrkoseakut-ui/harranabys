import { createClient } from '@/lib/supabase/server';
import DuyurularClient from '@/components/DuyurularClient';
import { redirect } from 'next/navigation';

function getHeadingLetter(titleOrLetter: string): string {
  const t = (titleOrLetter || '').trim().toLowerCase();
  if (t === 'a' || t.startsWith('kalite')) return 'A';
  if (t === 'b' || t.startsWith('eğitim') || t.startsWith('egitim')) return 'B';
  if (t === 'c' || t.startsWith('araştırma') || t.startsWith('arastirma')) return 'C';
  if (t === 'd' || t.startsWith('toplumsal')) return 'D';
  if (t === 'e' || t.startsWith('yönetim') || t.startsWith('yonetim')) return 'E';
  return (titleOrLetter || '').charAt(0).toUpperCase();
}

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

  const userRole = (profile?.rol ?? '').toLowerCase();
  const isAdmin = userRole.includes('yonetici') || userRole.includes('yönetici') || userRole.includes('admin');

  const { data: coordRecords } = await supabase
    .from('baslik_koordinatorleri')
    .select('baslik')
    .eq('kullanici_id', user.id);

  const isCoordinator = (coordRecords && coordRecords.length > 0) || false;
  const canCreate = !!isAdmin || isCoordinator;

  let availableHeadings: { id: number; kod: string; baslik_adi: string }[] = [];
  let availableInstructors: { id: string; ad_soyad: string; email: string }[] = [];

  if (canCreate) {
    const { data: allHeadings } = await supabase
      .from('ana_basliklar')
      .select('id, kod, baslik_adi')
      .order('id');

    const coordinatorLetters = (coordRecords || []).map((c: any) => getHeadingLetter(c.baslik));

    if (isAdmin) {
      availableHeadings = allHeadings || [];
      const { data: allProfs } = await supabase
        .from('profiller')
        .select('id, ad_soyad, email')
        .neq('rol', 'Beklemede')
        .not('email', 'is', null)
        .order('ad_soyad');
      availableInstructors = (allProfs || []).filter(p => p.email && p.email.includes('@'));
    } else if (isCoordinator) {
      availableHeadings = (allHeadings || []).filter(h => coordinatorLetters.includes((h.kod || '').toUpperCase().trim()));

      const { data: activePeriod } = await supabase
        .from('donemler')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      const { data: altOlcutler } = await supabase
        .from('alt_olcutler')
        .select('id, kod');

      const matchingIds = (altOlcutler || [])
        .filter(o => {
          const letter = (o.kod || '').split('.')[0].trim().toUpperCase();
          return coordinatorLetters.includes(letter);
        })
        .map(o => o.id);

      if (matchingIds.length > 0 && activePeriod?.id) {
        const { data: atamalar } = await supabase
          .from('kullanici_olcut_atamalari')
          .select('user_id')
          .in('alt_olcut_id', matchingIds)
          .eq('donem_id', activePeriod.id);

        const userIds = Array.from(new Set((atamalar || []).map(a => a.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiller')
            .select('id, ad_soyad, email')
            .in('id', userIds)
            .not('email', 'is', null)
            .order('ad_soyad');

          availableInstructors = (profs || []).filter(p => p.email && p.email.includes('@'));
        }
      }
    }
  }

  return (
    <DuyurularClient
      currentUserId={user.id}
      isAdmin={!!isAdmin}
      isCoordinator={isCoordinator}
      canCreate={canCreate}
      headings={availableHeadings}
      instructors={availableInstructors}
    />
  );
}
