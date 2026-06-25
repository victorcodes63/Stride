import type { RotaPolicy } from '@/lib/rota/conflict-rules';
import { DEFAULT_ROTA_POLICY } from '@/lib/rota/conflict-rules';

/** Stricter clinical rest defaults — wards can override via minRestHours. */
export const CLINICAL_ROTA_POLICY: RotaPolicy = {
  minRestMs: 11 * 60 * 60 * 1000,
  maxWeekWorkMs: 48 * 60 * 60 * 1000,
};

export function resolveClinicalRotaPolicy(minRestHours?: number): RotaPolicy {
  const restHours = minRestHours ?? 11;
  return {
    minRestMs: restHours * 60 * 60 * 1000,
    maxWeekWorkMs: CLINICAL_ROTA_POLICY.maxWeekWorkMs,
  };
}

export function isClinicalJobTitle(jobTitle: string | null | undefined): boolean {
  if (!jobTitle) return false;
  const t = jobTitle.toLowerCase();
  return (
    t.includes('nurse') ||
    t.includes('doctor') ||
    t.includes('clinical') ||
    t.includes('anaesth') ||
    t.includes('medical officer') ||
    t.includes('mo ')
  );
}

export function mergeHealthcareRotaPolicy(
  base: RotaPolicy,
  opts: { clinical?: boolean; minRestHours?: number },
): RotaPolicy {
  if (!opts.clinical) return base;
  const clinical = resolveClinicalRotaPolicy(opts.minRestHours);
  return {
    minRestMs: Math.max(base.minRestMs, clinical.minRestMs),
    maxWeekWorkMs: Math.min(base.maxWeekWorkMs, clinical.maxWeekWorkMs),
  };
}

export { DEFAULT_ROTA_POLICY };
