import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'HR Outsourcing | Stride Dashboard',
  description: 'End clients, outsourced workforce, payroll, attendance, leave, and billing.',
};

export default function OutsourcingModuleHomePage() {
  return <ModuleHomeContent domainId="hr-outsourcing" />;
}
