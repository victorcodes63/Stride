import type { Metadata } from 'next';
import SalesDealsContent from './SalesDealsContent';

export const metadata: Metadata = {
  title: 'Sales pipeline | Stride Dashboard',
};

export default function SalesDealsPage() {
  return <SalesDealsContent />;
}
