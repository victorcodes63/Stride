import type { Metadata } from 'next';
import SalesPromotionsContent from './SalesPromotionsContent';

export const metadata: Metadata = { title: 'Promotions | Stride Dashboard' };

export default function Page() {
  return <SalesPromotionsContent />;
}
