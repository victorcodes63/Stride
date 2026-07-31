import type { Metadata } from 'next';
import SalesVanLoadsContent from './SalesVanLoadsContent';

export const metadata: Metadata = { title: 'Van loads | Stride Dashboard' };

export default function Page() {
  return <SalesVanLoadsContent />;
}
