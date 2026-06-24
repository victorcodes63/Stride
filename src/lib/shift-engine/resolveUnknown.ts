import type { BiometricPunch } from './types';

/**
 * R5: Vendor `unknown` is coerced to `in` / `out` by alternation. The first `unknown` in
 * time order is treated as `in`; each subsequent `unknown` flips the implied mode. Typed punches
 * reset the alternation state.
 */
export function resolveUnknownPunchTypes(punches: BiometricPunch[]): BiometricPunch[] {
  const sorted = [...punches].sort((a, b) => a.at.localeCompare(b.at));
  let last: 'in' | 'out' | null = null;
  return sorted.map((p) => {
    if (p.type === 'in' || p.type === 'out') {
      last = p.type;
      return p;
    }
    const next: 'in' | 'out' = last === null || last === 'out' ? 'in' : 'out';
    last = next;
    return { ...p, type: next };
  });
}
