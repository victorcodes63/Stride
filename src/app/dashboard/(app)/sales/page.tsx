import type { Metadata } from 'next';
import SalesOverviewContent from './SalesOverviewContent';

export const metadata: Metadata = {
  title: 'Sales Performance | Stride Dashboard',
};

export default function SalesOverviewPage() {
  return <SalesOverviewContent />;
}
