import type { Metadata } from 'next';
import FinancialReportsContent from './FinancialReportsContent';

export const metadata: Metadata = {
 title: 'Financial Reports | Stride (Finance)',
};

export default function FinancialReportsPage() {
 return <FinancialReportsContent />;
}
