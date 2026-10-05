import { IndustrySectorPage } from '@/components/marketing/industries/IndustrySectorPage';
import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Oil & Gas / Energy',
  description:
    'Permit tracking, multi-entity HSE rollup, and compliance operations for petroleum retail and energy operators.',
  path: '/industries/energy',
});

const FEATURES = [
  { title: 'Permit register', body: 'Environmental, operating, and transport permits with expiry alerts and authority tracking.' },
  { title: 'Site hierarchy', body: 'Depots, terminals, and retail stations mapped to operating entities for group reporting.' },
  { title: 'Multi-entity HSE rollup', body: 'Consolidated view of open incidents and high-severity events across subsidiaries and JVs.' },
  { title: 'Compliance calendar', body: 'Expiring-soon permits surfaced alongside HSE actions on the Stride safety module.' },
] as const;

export default function EnergyIndustryPage() {
  return (
    <IndustrySectorPage
      sectorId="energy"
      name="Energy"
      path="/industries/energy"
      title="Permits and HSE on the Stride core."
      description="Site register, permit compliance, and group HSE rollup for East African energy operators."
      visual={<IndustryWireframePreview industryId="energy" />}
      features={FEATURES}
      cta={{
        title: 'See Stride for energy',
        description: 'Book a walkthrough of permit tracking and multi-entity HSE rollup on the Stride platform.',
      }}
    />
  );
}
