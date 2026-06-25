import { IndustriesPageContent } from '@/components/marketing/industries/IndustriesPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Industries',
  description:
    'Stride for HR consultancies, logistics, SACCOs, healthcare, energy and construction — sector workflows on one Kenya-native platform.',
  path: '/industries',
});

export default function IndustriesPage() {
  return <IndustriesPageContent />;
}
