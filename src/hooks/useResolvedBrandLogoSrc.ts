'use client';

import { useContext } from 'react';
import { brand } from '@/lib/brand';
import { DEFAULT_BRAND_LOGO_SRC, normalizeLogoSrc } from '@/lib/brand-constants';
import { BrandContext } from '@/components/BrandProvider';

/**
 * Prefer logo URL from `BrandProvider` (server snapshot) so SSR matches hydration.
 * Falls back to module `brand.logoSrc` when no provider (tests).
 */
export function useResolvedBrandLogoSrc(): string {
  const ctx = useContext(BrandContext);
  return normalizeLogoSrc(ctx?.logoSrc ?? brand.logoSrc ?? DEFAULT_BRAND_LOGO_SRC);
}
