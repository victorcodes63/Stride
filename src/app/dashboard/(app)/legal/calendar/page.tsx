import type { Metadata } from 'next';
import { LegalCalendarContent } from '@/components/legal/LegalCalendarContent';

export const metadata: Metadata = {
  title: 'Compliance calendar | Stride Dashboard',
  description: 'Upcoming obligations, contract renewals, and credential & policy expiries by month.',
};

export default function LegalCalendarPage() {
  return <LegalCalendarContent />;
}
