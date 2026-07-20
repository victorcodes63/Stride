import type { Metadata } from 'next';
import { LegalAnalyticsContent } from '@/components/legal/LegalAnalyticsContent';

export const metadata: Metadata = {
  title: 'Compliance analytics | Stride Dashboard',
  description: 'Risk scoring, obligation mix, and the six-month due-load outlook.',
};

export default function LegalAnalyticsPage() {
  return <LegalAnalyticsContent />;
}
