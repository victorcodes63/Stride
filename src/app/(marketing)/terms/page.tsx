import { MarketingLegalPage } from '@/components/marketing/legal/MarketingLegalPage';
import { getTermsSections, TERMS_LAST_UPDATED } from '@/components/marketing/legal/terms-sections';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'Terms of Service',
  description:
    'Stride SaaS terms — subscriptions, Paystack billing, data ownership, SLAs, and governing law for East African businesses.',
  path: '/terms',
});

export default function TermsOfServicePage() {
  return (
    <MarketingLegalPage
      eyebrow="Terms of service"
      title="Terms of Service"
      description="The agreement between your organisation and Raven Tech Group for use of the Stride operations platform — subscriptions, billing, acceptable use, and your data rights."
      lastUpdated={TERMS_LAST_UPDATED}
      sections={getTermsSections()}
    />
  );
}
