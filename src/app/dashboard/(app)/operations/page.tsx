import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'Operations | Stride Dashboard',
  description: 'Assets, HSE, announcements, and operational reporting.',
};

export default function OperationsModuleHomePage() {
  return <ModuleHomeContent domainId="admin-operations" />;
}
