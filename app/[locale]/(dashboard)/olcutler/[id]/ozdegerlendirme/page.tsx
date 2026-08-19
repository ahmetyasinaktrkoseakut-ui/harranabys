import OzdegerlendirmeRaporuClient from '@/components/OzdegerlendirmeRaporuClient';

export default function OzdegerlendirmePage({ params }: { params: Promise<{ id: string }> }) {
  return <OzdegerlendirmeRaporuClient params={params} />;
}
