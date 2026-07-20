import type { Metadata } from 'next';
import FleetOverviewContent from './FleetOverviewContent';

export const metadata: Metadata = {
  title: 'Fleet & logistics | Stride Dashboard',
  description: 'Transport orders, trips, tracking, compliance, settlements, and client billing.',
};

export default function FleetOverviewPage() {
  return <FleetOverviewContent />;
}
