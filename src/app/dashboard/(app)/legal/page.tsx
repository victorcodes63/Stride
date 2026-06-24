import type { Metadata } from 'next';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';

export const metadata: Metadata = {
  title: 'Legal & compliance | Stride Dashboard',
  description: 'Contracts, credentials, policies, and compliance obligations.',
};

export default function LegalModuleHomePage() {
  return <ModuleHomeContent domainId="legal-documents" />;
}
