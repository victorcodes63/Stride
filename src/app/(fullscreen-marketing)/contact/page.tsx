import type { Metadata } from 'next';
import { BookDemoPage } from '@/components/marketing/contact/BookDemoPage';

export const metadata: Metadata = {
  title: 'Book a demo',
  description: 'Book a Stride walkthrough — HR, finance, procurement, and more on one platform.',
};

export default function ContactPage() {
  return <BookDemoPage />;
}
