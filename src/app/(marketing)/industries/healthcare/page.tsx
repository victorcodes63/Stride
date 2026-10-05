import { IndustrySectorPage } from '@/components/marketing/industries/IndustrySectorPage';
import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Healthcare',
  description:
    'Clinical rota with licence gates, ward rules, biometric attendance, and SHIF-ready payroll for hospitals and clinics.',
  path: '/industries/healthcare',
});

const FEATURES = [
  { title: 'Clinical rota rules', body: 'Ward-level minimum rest and weekly hour caps stricter than default rota policy.' },
  { title: 'Licence gate', body: 'Block or flag shift assignments when medical licences are missing or expired.' },
  { title: 'Ward register', body: 'ICU, maternity, paediatrics — each with required credential categories.' },
  { title: 'SHIF hooks', body: 'Employer number, member SHIF numbers on file, and the monthly return extract from payroll.' },
] as const;

export default function HealthcareIndustryPage() {
  return (
    <IndustrySectorPage
      sectorId="healthcare"
      name="Healthcare"
      path="/industries/healthcare"
      title="Clinical workforce on the Stride core."
      description="Rota, attendance, credentials, and statutory payroll in one system — built for Kenyan hospitals and clinics."
      visual={<IndustryWireframePreview industryId="healthcare" />}
      features={FEATURES}
      cta={{
        title: 'See Stride for healthcare',
        description: 'Book a walkthrough of clinical rota, licence gates, and SHIF compliance on the Stride core.',
      }}
    />
  );
}
