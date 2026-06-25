import type { Metadata } from 'next';
import { BookDemoPage } from '@/components/marketing/contact/BookDemoPage';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata({
  title: 'Book a demo',
  description: 'Book a Stride walkthrough — HR, finance, procurement, and more on one platform.',
  path: '/contact',
});

export default function ContactPage() {
  return <BookDemoPage />;
}
