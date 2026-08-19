import PhaseClient from '@/components/PhaseClient';

export default function UygulamaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PhaseClient 
      params={params} 
      phaseId="uygulama" 
      phaseTitle="Uygulama" 
      showEylemPlanTablosu={false} 
    />
  );
}
