import type { Metadata } from 'next';
import TrainingProgramDetailContent from './TrainingProgramDetailContent';

export const metadata: Metadata = {
  title: 'Training program | Stride Dashboard',
};

export default async function TrainingProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TrainingProgramDetailContent programId={id} />;
}
