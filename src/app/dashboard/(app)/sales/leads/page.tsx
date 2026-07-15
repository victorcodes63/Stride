import type { Metadata } from 'next';
import SalesLeadsContent from './SalesLeadsContent';

export const metadata: Metadata = {
  title: 'Sales leads | Stride Dashboard',
};

export default function SalesLeadsPage() {
  return <SalesLeadsContent />;
}
