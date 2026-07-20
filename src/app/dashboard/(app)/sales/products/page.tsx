import type { Metadata } from 'next';
import SalesProductsContent from './SalesProductsContent';

export const metadata: Metadata = {
  title: 'Price book | Stride Dashboard',
};

export default function SalesProductsPage() {
  return <SalesProductsContent />;
}
