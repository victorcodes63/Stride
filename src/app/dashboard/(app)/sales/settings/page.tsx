import type { Metadata } from 'next';
import SalesWonDealSettingsContent from './SalesWonDealSettingsContent';

export const metadata: Metadata = {
  title: 'CRM settings | Stride Dashboard',
};

export default function SalesSettingsPage() {
  return <SalesWonDealSettingsContent />;
}
