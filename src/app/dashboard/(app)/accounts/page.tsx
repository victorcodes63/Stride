import type { Metadata } from 'next';
import AccountsOverviewContent from './AccountsOverviewContent';

export const metadata: Metadata = {
 title: 'Accounts | Stride Dashboard',
 description: 'Billing, payroll, contracts, debtors, and creditors',
};

export default function AccountsOverviewPage() {
 return <AccountsOverviewContent />;
}
