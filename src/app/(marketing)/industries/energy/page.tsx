import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';

export const metadata = {
  title: 'Oil & Gas / Energy',
  description:
    'Permit tracking, multi-entity HSE rollup, and compliance operations for petroleum retail and energy operators.',
};

const FEATURES = [
  { title: 'Permit register', body: 'Environmental, operating, and transport permits with expiry alerts and authority tracking.' },
  { title: 'Site hierarchy', body: 'Depots, terminals, and retail stations mapped to operating entities for group reporting.' },
  { title: 'Multi-entity HSE rollup', body: 'Consolidated view of open incidents and high-severity events across subsidiaries and JVs.' },
  { title: 'Compliance calendar', body: 'Expiring-soon permits surfaced alongside HSE actions on the Stride safety module.' },
] as const;

export default function EnergyIndustryPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Oil & Gas / Energy"
        title="Permits and HSE on the Stride core."
        description="Site register, permit compliance, and group HSE rollup for East African energy operators."
        visual={<IndustryWireframePreview industryId="energy" />}
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
      </MarketingPageBody>
      <MarketingCtaBand
        title="See Stride for energy"
        description="Book a walkthrough of permit tracking and multi-entity HSE rollup on the Stride platform."
        primary={{ href: '/contact', label: 'Book a demo' }}
        secondary={{ href: '/pricing', label: 'View pricing' }}
        variant="coral"
      />
    </>
  );
}
