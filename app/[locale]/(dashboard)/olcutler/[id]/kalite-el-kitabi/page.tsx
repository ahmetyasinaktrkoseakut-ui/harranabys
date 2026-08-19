import KaliteElKitabiClient from '@/components/KaliteElKitabiClient';

export default function KaliteElKitabiPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <KaliteElKitabiClient params={params} />
  );
}
