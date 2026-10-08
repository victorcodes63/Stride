import { SeoLandingPage } from '@/components/marketing/seo/SeoLandingPage';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { getSeoLanding } from '@/lib/marketing-seo-landings';

const landing = getSeoLanding('payroll-software-kenya');

export const metadata = marketingMetadata({
  title: landing.title,
  description: landing.description,
  path: landing.path,
  keywords: landing.keywords,
});

export default function PayrollSoftwareKenyaPage() {
  return <SeoLandingPage landing={landing} />;
}
