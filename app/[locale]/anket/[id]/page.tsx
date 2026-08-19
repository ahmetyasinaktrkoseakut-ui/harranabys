import PublicAnketClient from '@/components/PublicAnketClient';

export default function AnketPage({ params }: { params: Promise<{ id: string }> }) {
  return <PublicAnketClient params={params} />;
}
