import ProjectWorkspaceContent from './ProjectWorkspaceContent';

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectWorkspaceContent projectId={id} />;
}
