import {
  STRIDE_BRAND_PRIMARY,
  STRIDE_BRAND_SECONDARY,
  buildStrideBrandScaleCssVars,
  sanitizeStrideHexColor,
} from '@/lib/stride-palette';

/** Default brand theme colors — Stride palette. */
export const DEFAULT_PRIMARY_COLOR = STRIDE_BRAND_PRIMARY;
export const DEFAULT_SECONDARY_COLOR = STRIDE_BRAND_SECONDARY;

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function sanitizeHexColor(value: unknown, fallback: string): string {
  return sanitizeStrideHexColor(value, fallback);
}

/** Build CSS custom properties for runtime theming (primary + secondary scales). */
export function buildBrandThemeCssVars(primaryHex: string, secondaryHex: string): Record<string, string> {
  return buildStrideBrandScaleCssVars(
    sanitizeHexColor(primaryHex, DEFAULT_PRIMARY_COLOR),
    sanitizeHexColor(secondaryHex, DEFAULT_SECONDARY_COLOR),
  );
}
