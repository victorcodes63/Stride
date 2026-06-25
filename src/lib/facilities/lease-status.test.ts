import { describe, expect, it } from 'vitest';
import { daysUntil, resolveLeaseStatus } from '@/lib/facilities/lease-status';

describe('lease-status helpers', () => {
  it('marks lease expiring within 90 days', () => {
    const now = new Date('2026-06-01');
    const end = new Date('2026-07-15');
    expect(resolveLeaseStatus('active', end, now)).toBe('expiring_soon');
  });

  it('marks past end date as expired', () => {
    const now = new Date('2026-06-01');
    const end = new Date('2026-05-01');
    expect(resolveLeaseStatus('active', end, now)).toBe('expired');
  });

  it('computes days until end', () => {
    const now = new Date('2026-06-01');
    const end = new Date('2026-06-11');
    expect(daysUntil(end, now)).toBeGreaterThanOrEqual(9);
  });
});
