import { JdEditorContent } from '../JdEditorContent';

export default async function PerformanceJdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JdEditorContent jobDescriptionId={id} />;
}
