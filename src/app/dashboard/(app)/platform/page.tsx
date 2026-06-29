import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'Platform admin | Stride Dashboard',
  description: 'Company setup, system users, roles, holidays, audit log, and workspace settings.',
};

export default function PlatformAdminModuleHomePage() {
  return <ModuleHomeContent domainId="platform-admin" />;
}
