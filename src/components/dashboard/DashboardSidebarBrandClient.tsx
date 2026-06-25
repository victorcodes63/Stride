'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

/** Platform sidebar header — centered Stride wordmark (marketing identity). */
export function DashboardSidebarBrandClient() {
  return (
    <Link
      href="/dashboard"
      className="flex w-full items-center justify-center rounded-lg px-2 py-1.5 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-500/30"
      aria-label="Stride dashboard home"
    >
      <BrandLogo variant="sidebarWordmark" priority />
    </Link>
  );
}
