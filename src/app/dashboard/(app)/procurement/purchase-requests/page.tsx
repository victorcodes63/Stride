import type { Metadata } from 'next';
import PurchaseRequestsContent from './PurchaseRequestsContent';

export const metadata: Metadata = {
  title: 'Purchase Requests | Stride (Procurement)',
};

export default function PurchaseRequestsPage() {
  return <PurchaseRequestsContent />;
}
