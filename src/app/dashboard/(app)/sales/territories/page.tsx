import type { Metadata } from 'next';
import SalesTerritoriesContent from './SalesTerritoriesContent';

export const metadata: Metadata = { title: 'Territories | Stride Dashboard' };

export default function Page() {
  return <SalesTerritoriesContent />;
}
