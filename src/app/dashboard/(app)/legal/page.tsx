import type { Metadata } from 'next';
import { LegalHubContent } from '@/components/legal/LegalHubContent';

export const metadata: Metadata = {
  title: 'Legal & compliance | Stride Dashboard',
  description: 'Contracts, credentials, policies, and compliance obligations.',
};

export default function LegalModuleHomePage() {
  return <LegalHubContent />;
}
