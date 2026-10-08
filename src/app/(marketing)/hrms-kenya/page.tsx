import { SeoLandingPage } from '@/components/marketing/seo/SeoLandingPage';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { getSeoLanding } from '@/lib/marketing-seo-landings';

const landing = getSeoLanding('hrms-kenya');

export const metadata = marketingMetadata({
  title: landing.title,
  description: landing.description,
  path: landing.path,
  keywords: landing.keywords,
});

export default function HrmsKenyaPage() {
  return <SeoLandingPage landing={landing} />;
}
