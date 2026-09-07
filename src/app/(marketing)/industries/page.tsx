import { IndustriesPageContent } from '@/components/marketing/industries/IndustriesPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Industries — Vertical packs on the Stride core',
  description:
    'Industry packs for SACCOs, logistics, healthcare, energy and construction — specialised workflows on the same Stride HR & finance core.',
  path: '/industries',
});

export default function IndustriesPage() {
  return <IndustriesPageContent />;
}
