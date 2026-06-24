import type { Metadata } from 'next';
import ExpenseClaimsContent from './ExpenseClaimsContent';

export const metadata: Metadata = {
 title: 'Expense Claims | Stride (Finance)',
};

export default function ExpenseClaimsPage() {
 return <ExpenseClaimsContent />;
}
