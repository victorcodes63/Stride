'use client';

import Link from 'next/link';
import type { PublicBrand } from '@/lib/brand';
import { normalizeLogoSrc } from '@/lib/brand-constants';
import { isCustomLogo } from '@/lib/resolve-public-brand';
import { useEntity } from '@/components/EntitySwitcher';
import { orgInitials } from '@/components/dashboard/DashboardSidebarPoweredBy';

type Props = {
  brand: PublicBrand;
};

/**
 * Tenant-first sidebar brand — org identity only; Stride attribution lives in the footer.
 */
export function DashboardSidebarBrandClient({ brand }: Props) {
  const { activeEntity, showSwitcher, loading } = useEntity();
  const orgName = showSwitcher && !loading ? activeEntity.name : brand.orgName;
  const logoSrc = normalizeLogoSrc(brand.tenantLogoSrc);
  const hasTenantLogo = isCustomLogo(logoSrc);
  const accentColor =
    showSwitcher && !loading ? activeEntity.color : brand.primaryColor;

  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 rounded-lg px-1 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-500/30"
      title={orgName}
    >
      {hasTenantLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt={orgName}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
          decoding="async"
        />
      ) : (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        >
          {orgInitials(orgName)}
        </div>
      )}
      <div className="min-w-0 hidden sm:block">
        <span
          className="block truncate text-[13px] font-semibold leading-tight text-[var(--dash-text-strong)]"
          suppressHydrationWarning
        >
          {orgName}
        </span>
      </div>
    </Link>
  );
}
