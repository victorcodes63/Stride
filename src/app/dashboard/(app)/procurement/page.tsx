import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'Procurement | Stride Dashboard',
  description: 'Purchase requests, LPOs, vendor spend, and approvals.',
};

export default function ProcurementModuleHomePage() {
  return <ModuleHomeContent domainId="procurement" />;
}
