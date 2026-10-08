import type { Metadata } from 'next';
import { BookDemoPage } from '@/components/marketing/contact/BookDemoPage';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { contactEnquiryTypeForIntent } from '@/lib/pricing';

export const metadata: Metadata = marketingMetadata({
  title: 'Book a demo',
  description:
    'Book a Stride walkthrough — see HRIS, payroll and finance for Kenya, with plug-in modules and industry packs on one platform.',
  path: '/contact',
});

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  const { intent } = await searchParams;
  const rawIntent = Array.isArray(intent) ? intent[0] : intent;

  return <BookDemoPage defaultEnquiryType={contactEnquiryTypeForIntent(rawIntent)} />;
}
