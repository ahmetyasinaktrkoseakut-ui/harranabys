import PhaseClient from '@/components/PhaseClient';

export default function PlanlamaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PhaseClient 
      params={params} 
      phaseId="planlama" 
      phaseTitle="Planlama" 
      showEylemPlanTablosu={true} 
    />
  );
}
