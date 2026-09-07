import { PlatformPageContent } from '@/components/marketing/platform/PlatformPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Platform — Core modules & industry packs',
  description:
    'What Stride includes: HR & payroll and finance as the core, then plug-in modules (procurement, legal, projects, admin) and industry packs when you need them. KRA, NSSF, SHIF and M-Pesa from day one.',
  path: '/platform',
});

export default function PlatformPage() {
  return <PlatformPageContent />;
}
