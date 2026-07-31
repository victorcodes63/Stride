import type { Metadata } from 'next';
import SalesOrdersContent from './SalesOrdersContent';

export const metadata: Metadata = { title: 'Orders | Stride Dashboard' };

export default function SalesOrdersPage() {
  return <SalesOrdersContent />;
}
