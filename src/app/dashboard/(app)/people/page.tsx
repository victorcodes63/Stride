import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'People & workforce | Stride Dashboard',
  description: 'HR & Payroll module home — employees, leave, time, payroll, and recruitment.',
};

export default function PeopleModuleHomePage() {
  return <ModuleHomeContent domainId="hr-payroll" />;
}
