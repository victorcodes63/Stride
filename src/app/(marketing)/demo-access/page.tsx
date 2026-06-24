import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DemoAccessPageContent } from '@/components/marketing/DemoAccessPageContent';
import { isDemoAccessPageEnabled } from '@/lib/demo-access';

export const metadata: Metadata = {
  title: 'Demo sandbox',
  description: 'Seeded demo accounts for Stride sandbox environments.',
  robots: { index: false, follow: false },
};

export default function DemoAccessPage() {
  if (!isDemoAccessPageEnabled()) {
    notFound();
  }

  return <DemoAccessPageContent />;
}
