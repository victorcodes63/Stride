import type { Metadata } from 'next';
import { DashboardNotificationsContent } from '@/components/dashboard/notifications/DashboardNotificationsContent';
import { getMetadataTitle } from '@/lib/brand';

export const metadata: Metadata = {
  title: getMetadataTitle('Notifications'),
};

export default function NotificationsPage() {
  return <DashboardNotificationsContent />;
}
