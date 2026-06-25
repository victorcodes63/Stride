import { AboutPageContent } from '@/components/marketing/about/AboutPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'About',
  description:
    'Stride is an operations platform for East African businesses — built by Raven Tech Group.',
  path: '/about',
});

export default function AboutPage() {
  return <AboutPageContent />;
}
