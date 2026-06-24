import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';
import { DashboardSidebarBrandClient } from '@/components/dashboard/DashboardSidebarBrandClient';

/** Server shell resolves brand assets; client inner tracks the active entity switcher. */
export default async function DashboardSidebarBrand() {
  const brand = await getResolvedPublicBrand();
  return <DashboardSidebarBrandClient brand={brand} />;
}
