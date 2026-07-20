import type { CSSProperties } from 'react';
import {
  buildBrandThemeCssVars,
  buildTenantBrandThemeCssVars,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
} from '@/lib/brand-theme';

export type BrandThemeStyleOptions = {
  /** Tenant primary hex from company setup (e.g. a neutral grey to replace brand coral). */
  primaryColor?: string;
  /** Tenant secondary/ink hex from company setup. */
  secondaryColor?: string;
  /** Tier gate — only apply tenant colours when the plan is entitled to a custom colour scheme. */
  allowColorScheme?: boolean;
};

/**
 * Platform shell theme injected on `<html>`.
 * Defaults to Stride coral + ink. When the tenant is entitled to a custom colour scheme
 * (`allowColorScheme`) and has picked a primary colour, their palette is applied instead —
 * recolouring the dashboard, ESS, public, and button surfaces. KPI swatch tokens live in
 * dashboard-theme.css (light + .dark overrides).
 */
export function brandThemeStyle(options?: BrandThemeStyleOptions): CSSProperties {
  if (options?.allowColorScheme && options.primaryColor) {
    return buildTenantBrandThemeCssVars(
      options.primaryColor,
      options.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
    ) as CSSProperties;
  }
  return buildBrandThemeCssVars(DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR) as CSSProperties;
}
