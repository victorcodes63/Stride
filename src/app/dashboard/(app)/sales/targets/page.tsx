import type { Metadata } from 'next';
import SalesTargetsContent from './SalesTargetsContent';

export const metadata: Metadata = {
  title: 'Sales targets | Stride Dashboard',
};

export default function SalesTargetsPage() {
  return <SalesTargetsContent />;
}
