import { describe, expect, it } from 'vitest';
import {
  canRequestLeave,
  computeRemainingLeaveDays,
  countInclusiveDays,
  hasDateRangeOverlap,
} from '@/lib/ess/leave-rules';

describe('ESS leave rules', () => {
  it('counts inclusive leave days correctly', () => {
    const days = countInclusiveDays(
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-03T00:00:00.000Z'),
    );
    expect(days).toBe(3);
  });

  it('detects overlap between existing and requested dates', () => {
    const overlap = hasDateRangeOverlap(
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-12T00:00:00.000Z'),
      new Date('2026-04-12T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
    );
    expect(overlap).toBe(true);
  });

  it('computes remaining leave and validates requests', () => {
    const remaining = computeRemainingLeaveDays({
      entitled: 21,
      used: 5,
      pending: 3,
    });
    expect(remaining).toBe(13);
    expect(
      canRequestLeave({
        requestedDays: 10,
        entitled: 21,
        used: 5,
        pending: 3,
      }),
    ).toBe(true);
    expect(
      canRequestLeave({
        requestedDays: 14,
        entitled: 21,
        used: 5,
        pending: 3,
      }),
    ).toBe(false);
  });
});
