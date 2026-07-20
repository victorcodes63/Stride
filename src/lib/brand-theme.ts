import {
  STRIDE_BRAND_PRIMARY,
  STRIDE_BRAND_SECONDARY,
  buildStrideBrandScaleCssVars,
  sanitizeStrideHexColor,
  strideHexToRgbTriple,
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

/**
 * Per-tenant runtime theme. Extends the brand/primary scale with overrides for the master
 * accent tokens (`--stride-coral` family + logo) that the dashboard, public, and ESS surfaces
 * reference directly. Because these are emitted as an inline `style` on `<html>`, they win over
 * every stylesheet rule — including `html.dark` — so the tenant colour cascades everywhere the
 * default coral would. Neutral paper/ink tokens are intentionally left untouched.
 */
export function buildTenantBrandThemeCssVars(
  primaryHex: string,
  secondaryHex: string,
): Record<string, string> {
  const primary = sanitizeHexColor(primaryHex, DEFAULT_PRIMARY_COLOR);
  const base = buildBrandThemeCssVars(primary, secondaryHex);
  return {
    ...base,
    '--stride-coral': primary,
    '--stride-coral-deep': base['--brand-primary-hover'] ?? primary,
    '--stride-coral-rgb': strideHexToRgbTriple(primary),
    '--stride-logo': primary,
  };
}
