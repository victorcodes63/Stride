import { IndustrySectorPage } from '@/components/marketing/industries/IndustrySectorPage';
import { ProductIndustryPreview } from '@/components/marketing/product/ProductIndustryPreview';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Construction',
  description:
    'Site hierarchy, plant asset tracking, and subcontractor accounts payable for construction and civil contractors.',
  path: '/industries/construction',
});

const FEATURES = [
  { title: 'Site hierarchy', body: 'Programme → phase → site structure with parent-child links and project integration.' },
  { title: 'Plant assets', body: 'Excavators, cranes, and hired plant assigned to sites with daily hire rates and status.' },
  { title: 'Subcontractor AP', body: 'Subcontractor register with retention, invoiced amounts, and balance due.' },
  { title: 'Projects core', body: 'Links to Stride projects, milestones, and budget tracking for multi-site programmes.' },
] as const;

export default function ConstructionIndustryPage() {
  return (
    <IndustrySectorPage
      sectorId="construction"
      name="Construction"
      path="/industries/construction"
      title="Sites, plant, and subcontractors."
      description="Construction vertical pack on the Stride projects and finance core, built for Kenyan contractors."
      visual={<ProductIndustryPreview industryId="construction" />}
      features={FEATURES}
      cta={{
        title: 'See Stride for construction',
        description: 'Book a walkthrough of site hierarchy, plant tracking, and subcontractor AP.',
      }}
    />
  );
}
