import { MarketingLegalPage } from '@/components/marketing/legal/MarketingLegalPage';
import {
  getPrivacySections,
  PRIVACY_LAST_UPDATED,
} from '@/components/marketing/legal/privacy-sections';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Privacy Policy',
  description:
    'How Stride collects, uses, and protects personal data for East African businesses — Kenya DPA 2019 aligned, ODPC-ready.',
  path: '/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <MarketingLegalPage
      eyebrow="Privacy policy"
      title="Privacy Policy"
      description="How Raven Tech Group processes personal data when you use Stride — the multi-tenant operations platform for HR, payroll, finance, and more across East Africa."
      lastUpdated={PRIVACY_LAST_UPDATED}
      sections={getPrivacySections()}
    />
  );
}
