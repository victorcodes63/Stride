import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'Projects | Stride Dashboard',
  description: 'Deliverables, tasks, and budget vs execution.',
};

export default function ProjectsModuleHomePage() {
  return <ModuleHomeContent domainId="projects" />;
}
