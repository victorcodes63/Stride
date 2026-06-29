'use client';

import { usePublicBrand } from '@/components/BrandProvider';
import { useEntity } from '@/components/EntitySwitcher';
import { GENERIC_ORG_PLACEHOLDER } from '@/lib/deployment-cell';

function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
}

function resolveSidebarOrgName(input: {
  showSwitcher: boolean;
  loading: boolean;
  activeEntityName: string;
  tenantOrgName?: string | null;
  brandOrgName: string;
}): string {
  if (input.showSwitcher && !input.loading) return input.activeEntityName;
  const fromSession = input.tenantOrgName?.trim();
  if (fromSession) return fromSession;
  if (input.brandOrgName.trim() && input.brandOrgName !== GENERIC_ORG_PLACEHOLDER) {
    return input.brandOrgName;
  }
  return GENERIC_ORG_PLACEHOLDER;
}

/** Minimal tenant attribution — Stride stays out of the sidebar header. */
export function DashboardSidebarPoweredBy({
  tenantOrgName,
}: {
  /** Active tenant organization from dashboard session (Organization.name). */
  tenantOrgName?: string | null;
}) {
  const brand = usePublicBrand();
  const { activeEntity, showSwitcher, loading } = useEntity();

  if (brand.hidePoweredBy) return null;

  const orgName = resolveSidebarOrgName({
    showSwitcher,
    loading,
    activeEntityName: activeEntity.name,
    tenantOrgName,
    brandOrgName: brand.orgName,
  });

  return (
    <p className="px-3.5 pb-2.5 pt-1.5 text-center text-[10px] leading-snug text-[var(--dash-text-subtle)]">
      <span className="font-medium text-[var(--dash-text-muted)]" suppressHydrationWarning>
        {orgName}
      </span>{' '}
      powered by{' '}
      <span className="font-semibold text-[var(--dash-text-muted)]">{brand.appName}</span>
    </p>
  );
}

export { orgInitials };
