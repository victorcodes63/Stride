import type { Metadata } from 'next';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';
import PublicAppShell from '@/components/public/PublicAppShell';

export async function generateMetadata(): Promise<Metadata> {
  const { orgName, appName } = await getResolvedPublicBrand();
  const employerName = orgName || appName;
  return {
    title: 'Careers',
    description: `Careers at ${employerName}. Learn about open opportunities and how to apply.`,
    openGraph: {
      title: `Careers • ${employerName}`,
      description: 'Join our team — explore open roles and apply online.',
      url: '/careers',
    },
  };
}

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicAppShell>{children}</PublicAppShell>;
}
