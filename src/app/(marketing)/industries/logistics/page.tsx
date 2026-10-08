import { IndustrySectorPage } from '@/components/marketing/industries/IndustrySectorPage';
import { ProductIndustryPreview } from '@/components/marketing/product/ProductIndustryPreview';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Logistics industry pack',
  description:
    'Stride industry pack for cargo and road freight: fleet, trips, drivers and billing on the same HR & finance platform, not a separate fleet system.',
  path: '/industries/logistics',
});

const FEATURES = [
  {
    title: 'Fleet register',
    body: 'Vehicles, capacity, compliance documents and maintenance history in one register.',
  },
  {
    title: 'Trip lifecycle',
    body: 'From order intake through compliance checks, dispatch, in-transit updates, POD and settlement.',
  },
  {
    title: 'Driver & partner management',
    body: 'Managed fleet drivers linked to HR records; outsourced transporters with rate cards and payouts.',
  },
  {
    title: 'Billing on the core',
    body: 'Completed trips flow into invoicing and collections on the same finance module as payroll.',
  },
] as const;

const LOGISTICS_FAQ = [
  {
    q: 'Is GPS tracking included?',
    a: 'Version one focuses on manual status updates and POD capture. Telematics integration hooks are planned for a later release.',
  },
  {
    q: 'Can we run managed fleet and outsourced trips?',
    a: 'Yes. Trip settlement supports driver mileage for managed fleet and partner payouts gated on POD verification.',
  },
  {
    q: 'Does it replace our HRIS?',
    a: 'No. It extends Stride. Driver payroll, leave and compliance sit on the same core as fleet operations.',
  },
] as const;

export default function LogisticsIndustryPage() {
  return (
    <IndustrySectorPage
      sectorId="logistics"
      name="Logistics"
      path="/industries/logistics"
      title="Fleet operations on the same platform as payroll."
      description="Built for cargo operators, transporters and 3PLs who need trip management, compliance and billing without bolting on a separate fleet system."
      visual={<ProductIndustryPreview industryId="logistics" />}
      features={FEATURES}
      faq={LOGISTICS_FAQ}
      cta={{
        title: 'See Stride for logistics',
        description: 'Book a walkthrough of fleet, trip and settlement workflows on the Stride core.',
      }}
    />
  );
}
