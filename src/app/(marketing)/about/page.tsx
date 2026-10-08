import { AboutPageContent } from '@/components/marketing/about/AboutPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'About Stride',
  description:
    'Stride is an HRIS and operations platform for East African businesses—payroll, HR and finance—built by Raven Tech Group in Nairobi.',
  path: '/about',
});

export default function AboutPage() {
  return <AboutPageContent />;
}
