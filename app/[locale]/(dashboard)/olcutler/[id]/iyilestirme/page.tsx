import PhaseClient from '@/components/PhaseClient';

export default function IyilestirmePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PhaseClient 
      params={params} 
      phaseId="onlem" 
      phaseTitle="İyileştirme / Önlem Alma" 
      showEylemPlanTablosu={false} 
    />
  );
}
