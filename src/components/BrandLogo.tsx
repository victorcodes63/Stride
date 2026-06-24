'use client';

import { usePublicBrand } from '@/components/BrandProvider';
import {
  STRIDE_MARK_SRC,
  STRIDE_WORDMARK_SRC,
  normalizeLogoSrc,
} from '@/lib/brand-constants';

type BrandLogoProps = {
  className?: string;
  variant?: 'mark' | 'markSm' | 'markLg' | 'header' | 'sidebarExpanded' | 'sidebarCollapsed' | 'compact' | 'auth' | 'authPanel';
  priority?: boolean;
  alt?: string;
  /** Override URL — use when parent already has brand snapshot */
  src?: string;
};

const WORDMARK_VARIANTS = new Set<NonNullable<BrandLogoProps['variant']>>(['auth', 'authPanel']);

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
  const { appName, logoSrc: brandLogoSrc } = usePublicBrand();
  const size = variantSize[variant];
  const cls = className ?? markVariantClass[variant];
  const useWordmark = WORDMARK_VARIANTS.has(variant);
  const defaultSrc = useWordmark ? STRIDE_WORDMARK_SRC : STRIDE_MARK_SRC;
  const logoSrc = normalizeLogoSrc(src ?? brandLogoSrc ?? defaultSrc);
  const resolvedSrc =
    !src && !useWordmark && logoSrc.includes('stride-wordmark')
      ? STRIDE_MARK_SRC
      : logoSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt ?? appName}
      width={useWordmark ? undefined : size}
      height={size}
      className={cls}
      decoding="async"
    />
  );
}
