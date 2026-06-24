import type { BiometricPunch } from './types';

/**
 * R4: Two same-type punches within 60s → keep first, drop rest (stable order by `at`).
 */
export function debouncePunchesWithin60s(punches: BiometricPunch[]): BiometricPunch[] {
  if (punches.length <= 1) return [...punches];
  const sorted = [...punches].sort((a, b) => a.at.localeCompare(b.at));
  const out: BiometricPunch[] = [];
  const WINDOW_MS = 60_000;
  for (const p of sorted) {
    const t = new Date(p.at).getTime();
    const last = out[out.length - 1];
    if (!last) {
      out.push(p);
      continue;
    }
    if (p.type === last.type && t - new Date(last.at).getTime() <= WINDOW_MS) {
      continue;
    }
    out.push(p);
  }
  return out;
}
