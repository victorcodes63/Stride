import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';

export const metadata = {
  title: 'Construction',
  description:
    'Site hierarchy, plant asset tracking, and subcontractor accounts payable for construction and civil contractors.',
};

const FEATURES = [
  { title: 'Site hierarchy', body: 'Programme → phase → site structure with parent-child links and project integration.' },
  { title: 'Plant assets', body: 'Excavators, cranes, and hired plant assigned to sites with daily hire rates and status.' },
  { title: 'Subcontractor AP', body: 'Subcontractor register with retention, invoiced amounts, and balance due.' },
  { title: 'Projects core', body: 'Links to Stride projects, milestones, and budget tracking for multi-site programmes.' },
] as const;

export default function ConstructionIndustryPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Construction"
        title="Sites, plant, and subcontractors."
        description="Construction vertical pack on the Stride projects and finance core — built for Kenyan contractors."
        visual={<IndustryWireframePreview industryId="construction" />}
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
        title="See Stride for construction"
        description="Book a walkthrough of site hierarchy, plant tracking, and subcontractor AP."
        primary={{ href: '/contact', label: 'Book a demo' }}
        secondary={{ href: '/pricing', label: 'View pricing' }}
        variant="coral"
      />
    </>
  );
}
