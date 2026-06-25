import type { Metadata } from 'next';
import ProjectsOverviewContent from './ProjectsOverviewContent';

export const metadata: Metadata = {
  title: 'Projects | Stride Dashboard',
  description: 'Deliverables, tasks, and budget vs execution.',
};

export default function ProjectsModuleHomePage() {
  return <ProjectsOverviewContent />;
}
