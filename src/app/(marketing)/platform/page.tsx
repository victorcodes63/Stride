import { PlatformPageContent } from '@/components/marketing/platform/PlatformPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Platform',
  description:
    'Nine product areas on one platform — HR, finance, fleet, outsourcing, sales and more. Built for East Africa with KRA, NSSF, SHIF and M-Pesa from day one.',
  path: '/platform',
});

export default function PlatformPage() {
  return <PlatformPageContent />;
}
