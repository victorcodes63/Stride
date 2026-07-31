import type { Metadata } from 'next';
import InventoryStockContent from './InventoryStockContent';

export const metadata: Metadata = { title: 'Inventory | Stride Dashboard' };

export default function InventoryPage() {
  return <InventoryStockContent />;
}
