import type { Metadata } from 'next';
import SalesProductsContent from './SalesProductsContent';

export const metadata: Metadata = {
  title: 'Products | Stride Dashboard',
};

export default function SalesProductsPage() {
  return <SalesProductsContent />;
}
