import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';

export const metadata = {
  title: 'Healthcare',
  description:
    'Clinical rota with licence gates, ward rules, biometric attendance, and NHIF/SHIF-ready payroll for hospitals and clinics.',
};

const FEATURES = [
  { title: 'Clinical rota rules', body: 'Ward-level minimum rest and weekly hour caps stricter than default rota policy.' },
  { title: 'Licence gate', body: 'Block or flag shift assignments when medical licences are missing or expired.' },
  { title: 'Ward register', body: 'ICU, maternity, paediatrics — each with required credential categories.' },
  { title: 'NHIF / SHIF hooks', body: 'Employer number, member NHIF on file, and monthly return extract from payroll.' },
] as const;

export default function HealthcareIndustryPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Healthcare"
        title="Clinical workforce on the Stride core."
        description="Rota, attendance, credentials, and statutory payroll in one system — built for Kenyan hospitals and clinics."
        visual={<IndustryWireframePreview industryId="healthcare" />}
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
        title="See Stride for healthcare"
        description="Book a walkthrough of clinical rota, licence gates, and NHIF compliance on the Stride core."
        primary={{ href: '/contact', label: 'Book a demo' }}
        secondary={{ href: '/pricing', label: 'View pricing' }}
        variant="coral"
      />
    </>
  );
}
