import { PlatformPageContent } from '@/components/marketing/platform/PlatformPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Platform',
  description:
    'Six core modules on one platform — HR, finance, procurement, legal, projects and admin. Built for East Africa with KRA, NSSF, SHIF and M-Pesa from day one.',
  path: '/platform',
});

export default function PlatformPage() {
  return <PlatformPageContent />;
}
