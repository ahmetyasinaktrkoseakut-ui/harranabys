import KontrolEtmeClient from '@/components/KontrolEtmeClient';

export default function KontrolEtmePage({ params }: { params: Promise<{ id: string }> }) {
  return <KontrolEtmeClient params={params} />;
}
