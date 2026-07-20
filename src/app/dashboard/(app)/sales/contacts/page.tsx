import type { Metadata } from 'next';
import SalesContactsContent from './SalesContactsContent';

export const metadata: Metadata = {
  title: 'Sales contacts | Stride Dashboard',
};

export default function SalesContactsPage() {
  return <SalesContactsContent />;
}
