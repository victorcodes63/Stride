import type { Metadata } from 'next';
import SalesCommissionsContent from './SalesCommissionsContent';

export const metadata: Metadata = {
  title: 'Sales commissions | Stride Dashboard',
};

export default function SalesCommissionsPage() {
  return <SalesCommissionsContent />;
}
