import type { Metadata } from 'next';
import SalesTasksContent from './SalesTasksContent';

export const metadata: Metadata = {
  title: 'Sales tasks | Stride Dashboard',
};

export default function SalesTasksPage() {
  return <SalesTasksContent />;
}
