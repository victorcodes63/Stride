import { SeoLandingPage } from '@/components/marketing/seo/SeoLandingPage';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { getSeoLanding } from '@/lib/marketing-seo-landings';

const landing = getSeoLanding('mpesa-payroll');

export const metadata = marketingMetadata({
  title: landing.title,
  description: landing.description,
  path: landing.path,
  keywords: landing.keywords,
});

export default function MpesaPayrollPage() {
  return <SeoLandingPage landing={landing} />;
}
