import type { Metadata } from 'next';
import SalesQuotesContent from './SalesQuotesContent';

export const metadata: Metadata = {
  title: 'Quotes | Stride Dashboard',
};

export default function SalesQuotesPage() {
  return <SalesQuotesContent />;
}
