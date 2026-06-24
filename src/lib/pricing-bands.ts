/**
 * Platform + Modules pricing bands (Illustrative — calibrate with first 3 logos).
 * Structural model from Imara Vertical BMS Strategy Roadmap §5.
 */

import type { ModuleKey } from '@/lib/modules';

export type PricingBandId = 'starter' | 'growth' | 'business' | 'enterprise';

export type PricingBand = {
  id: PricingBandId;
  label: string;
  /** Inclusive org size upper bound; enterprise is open-ended. */
  maxHeadcount: number | null;
  platformBaseKesMin: number;
  platformBaseKesMax: number;
  payrollAddonKesMin: number;
  payrollAddonKesMax: number;
  moduleAddonKesMin: number;
  moduleAddonKesMax: number;
};

/** Billable add-on modules (excludes always-on core). */
export const BILLABLE_MODULE_KEYS: ModuleKey[] = [
  'leave',
  'time',
  'payroll',
  'ats',
  'performance',
  'hse',
  'accounts',
  'disciplinary',
  'reports',
  'assets',
  'ess',
  'communications',
  'training',
  'documents',
];

export const PRICING_BANDS: PricingBand[] = [
  {
    id: 'starter',
    label: 'Starter',
    maxHeadcount: 50,
    platformBaseKesMin: 15_000,
    platformBaseKesMax: 25_000,
    payrollAddonKesMin: 15_000,
    payrollAddonKesMax: 25_000,
    moduleAddonKesMin: 8_000,
    moduleAddonKesMax: 15_000,
  },
  {
    id: 'growth',
    label: 'Growth',
    maxHeadcount: 150,
    platformBaseKesMin: 40_000,
    platformBaseKesMax: 60_000,
    payrollAddonKesMin: 25_000,
    payrollAddonKesMax: 40_000,
    moduleAddonKesMin: 15_000,
    moduleAddonKesMax: 25_000,
  },
  {
    id: 'business',
    label: 'Business',
    maxHeadcount: 500,
    platformBaseKesMin: 90_000,
    platformBaseKesMax: 120_000,
    payrollAddonKesMin: 40_000,
    payrollAddonKesMax: 60_000,
    moduleAddonKesMin: 25_000,
    moduleAddonKesMax: 40_000,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    maxHeadcount: null,
    platformBaseKesMin: 150_000,
    platformBaseKesMax: 150_000,
    payrollAddonKesMin: 0,
    payrollAddonKesMax: 0,
    moduleAddonKesMin: 0,
    moduleAddonKesMax: 0,
  },
];

export function resolvePricingBand(headcount: number): PricingBand {
  if (headcount <= 50) return PRICING_BANDS[0];
  if (headcount <= 150) return PRICING_BANDS[1];
  if (headcount <= 500) return PRICING_BANDS[2];
  return PRICING_BANDS[3];
}

export function formatKesRange(min: number, max: number): string {
  if (min === max) return min >= 1000 ? `KES ${(min / 1000).toFixed(0)}k+` : `KES ${min.toLocaleString('en-KE')}`;
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : n.toLocaleString('en-KE'));
  return `KES ${fmt(min)}–${fmt(max)}`;
}
