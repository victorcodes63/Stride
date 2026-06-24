import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'Admin & operations | Stride Dashboard',
  description: 'Fleet, assets, HSE, communications, reports, and system administration.',
};

export default function OperationsModuleHomePage() {
  return <ModuleHomeContent domainId="admin-operations" />;
}
