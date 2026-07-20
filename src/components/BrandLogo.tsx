'use client';

import { usePublicBrand } from '@/components/BrandProvider';
import {
  DEFAULT_BRAND_LOGO_SRC,
  STRIDE_MARK_SRC,
  STRIDE_WORDMARK_SRC,
  isLegacyPlatformLogo,
  normalizeLogoSrc,
} from '@/lib/brand-constants';

/** A tenant-uploaded logo (not one of the default Stride marks / legacy platform logos). */
function isCustomTenantLogo(src: string | undefined): boolean {
  if (!src) return false;
  const t = normalizeLogoSrc(src);
  return Boolean(
    t &&
      t !== STRIDE_MARK_SRC &&
      t !== STRIDE_WORDMARK_SRC &&
      t !== DEFAULT_BRAND_LOGO_SRC &&
      !isLegacyPlatformLogo(t) &&
      !t.endsWith('platform-logo.png'),
  );
}

type BrandLogoProps = {
  className?: string;
  variant?: 'mark' | 'markSm' | 'markLg' | 'header' | 'sidebarExpanded' | 'sidebarCollapsed' | 'compact' | 'auth' | 'authPanel' | 'sidebarWordmark';
  priority?: boolean;
  alt?: string;
  /** Override URL — use when parent already has brand snapshot */
  src?: string;
};

const WORDMARK_VARIANTS = new Set<NonNullable<BrandLogoProps['variant']>>([
  'auth',
  'authPanel',
  'sidebarWordmark',
]);

const markVariantClass: Record<NonNullable<BrandLogoProps['variant']>, string> = {
  mark: 'h-10 w-10 object-contain',
  markSm: 'h-9 w-9 object-contain',
  markLg: 'h-12 w-12 object-contain',
  header: 'h-9 w-9 object-contain',
  sidebarExpanded: 'h-8 w-8 object-contain',
  sidebarCollapsed: 'h-8 w-8 object-contain',
  compact: 'h-8 w-8 object-contain',
  auth: 'h-11 w-auto max-w-[160px] object-contain object-left',
  authPanel: 'h-11 w-auto max-w-[11rem] object-contain object-left',
  sidebarWordmark: 'mx-auto h-9 w-auto max-w-[9rem] object-contain object-center',
};

const variantSize: Record<NonNullable<BrandLogoProps['variant']>, number> = {
  mark: 40,
  markSm: 36,
  markLg: 48,
  header: 36,
  sidebarExpanded: 32,
  sidebarCollapsed: 32,
  compact: 32,
  auth: 44,
  authPanel: 44,
  sidebarWordmark: 36,
};

/**
 * Brand logo — mark for compact surfaces, wordmark for auth panels.
 */
export default function BrandLogo({
  className,
  variant = 'mark',
  alt,
  src,
}: BrandLogoProps) {
  const { appName, logoSrc: brandLogoSrc, tenantLogoSrc } = usePublicBrand();
  const useWordmark = WORDMARK_VARIANTS.has(variant);
  const size = variantSize[variant];
  const cls = className ?? markVariantClass[variant];
  const tenantLogo = isCustomTenantLogo(tenantLogoSrc) ? normalizeLogoSrc(tenantLogoSrc) : undefined;

  // Wordmark slots (auth panels, sidebar) show the tenant's own logo when one is uploaded,
  // otherwise the Stride wordmark. Stable <img> attrs keep SSR/hydration in sync.
  if (useWordmark) {
    const custom = src ?? tenantLogo;
    const wordmarkSrc = normalizeLogoSrc(custom ?? STRIDE_WORDMARK_SRC);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={wordmarkSrc}
        alt={alt ?? (custom ? appName : 'Stride')}
        width={144}
        height={size}
        className={cls}
        decoding="async"
      />
    );
  }

  const logoSrc = normalizeLogoSrc(src ?? tenantLogo ?? brandLogoSrc ?? STRIDE_MARK_SRC);
  const resolvedSrc = logoSrc.includes('stride-wordmark') ? STRIDE_MARK_SRC : logoSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt ?? appName}
      width={size}
      height={size}
      className={cls}
      decoding="async"
    />
  );
}
