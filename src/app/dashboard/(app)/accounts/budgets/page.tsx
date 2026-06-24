import type { Metadata } from 'next';
import BudgetsContent from './BudgetsContent';

export const metadata: Metadata = {
 title: 'Budgets | Stride (Finance)',
};

export default function BudgetsPage() {
 return <BudgetsContent />;
}
