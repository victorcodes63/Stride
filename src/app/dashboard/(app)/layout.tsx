import { headers } from 'next/headers';
import DashboardAppLayoutClient from './DashboardAppLayoutClient';
import DashboardSidebarBrand from '@/components/dashboard/DashboardSidebarBrand';

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
