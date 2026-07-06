import type { Metadata } from 'next';
import SalesAttainmentContent from './SalesAttainmentContent';

export const metadata: Metadata = {
  title: 'Sales attainment | Stride Dashboard',
};

export default function SalesAttainmentPage() {
  return <SalesAttainmentContent />;
}
