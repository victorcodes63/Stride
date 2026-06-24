import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import { FleetBoardMockup } from '@/components/marketing/mockups/FleetBoardMockup';

export const metadata = {
  title: 'Logistics & Cargo',
  description:
    'Fleet management, route and trip planning, driver records and delivery tracking for East African logistics operators.',
};

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
    a: 'No — it extends Stride. Driver payroll, leave and compliance sit on the same core as fleet operations.',
  },
] as const;

export default function LogisticsIndustryPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Logistics & Cargo"
        title="Fleet operations on the same platform as payroll."
        description="Built for cargo operators, transporters and 3PLs who need trip management, compliance and billing without bolting on a separate fleet system."
        visual={<FleetBoardMockup />}
      />

      <MarketingPageBody>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl border border-pub-border bg-white p-5 sm:p-6">
              <h2 className="font-heading text-lg font-bold text-pub-ink">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-pub-ink-muted">{f.body}</p>
            </article>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold text-pub-ink">Logistics FAQ</h2>
          <div className="mt-6 divide-y divide-pub-border rounded-2xl border border-pub-border bg-white">
            {LOGISTICS_FAQ.map((item) => (
              <div key={item.q} className="px-6 py-5">
                <h3 className="font-heading font-semibold text-pub-ink">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pub-ink-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </MarketingPageBody>

      <MarketingCtaBand
        title="See Stride for logistics"
        description="Book a walkthrough of fleet, trip and settlement workflows on the Stride core."
        primary={{ href: '/contact', label: 'Book a demo' }}
        secondary={{ href: '/pricing', label: 'View pricing' }}
        variant="coral"
      />
    </>
  );
}
