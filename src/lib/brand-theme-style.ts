import type { CSSProperties } from 'react';
import {
  buildBrandThemeCssVars,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
} from '@/lib/brand-theme';

/**
 * Platform shell theme — always Stride coral + ink.
 * Tenant colours from company setup apply to documents and careers only.
 * KPI swatch tokens live in dashboard-theme.css (light + .dark overrides).
 */
export function brandThemeStyle(): CSSProperties {
  return buildBrandThemeCssVars(DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR) as CSSProperties;
}
