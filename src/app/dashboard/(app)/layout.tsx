import type { Metadata } from 'next';
import { headers } from 'next/headers';
import DashboardAppLayoutClient from './DashboardAppLayoutClient';
import DashboardSidebarBrand from '@/components/dashboard/DashboardSidebarBrand';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';

/** White-label the browser tab for the authenticated dashboard (overrides the root “| Stride”). */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getResolvedPublicBrand();
  return {
    title: {
      default: brand.appName,
      template: `%s | ${brand.appName}`,
    },
  };
}

export default async function DashboardAppLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 const initialPathname = (await headers()).get('x-pathname') ?? '/dashboard';

 return (
 <DashboardAppLayoutClient
 sidebarBrand={<DashboardSidebarBrand />}
 initialPathname={initialPathname}
 >
 {children}
 </DashboardAppLayoutClient>
 );
}
