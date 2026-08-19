import OlgunlukClient from '@/components/OlgunlukClient';

export default function OlgunlukPage({ params }: { params: Promise<{ id: string }> }) {
  return <OlgunlukClient params={params} />;
}
