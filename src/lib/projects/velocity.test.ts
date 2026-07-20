import { describe, expect, it } from 'vitest';
import { buildVelocitySeries } from './velocity';

describe('buildVelocitySeries', () => {
  it('returns the requested number of weeks', () => {
    const series = buildVelocitySeries({
      weeks: 4,
      completedAt: [],
      createdAt: [],
      now: new Date('2026-07-20T12:00:00Z'),
    });
    expect(series).toHaveLength(4);
    expect(series[0]?.weekStart < series[3]?.weekStart!).toBe(true);
  });

  it('buckets completions into the correct week', () => {
    // 2026-07-20 is a Monday → current week starts that day.
    const series = buildVelocitySeries({
      weeks: 2,
      completedAt: [
        new Date('2026-07-14T10:00:00'), // previous week (Mon 13 – Sun 19)
        new Date('2026-07-15T10:00:00'), // previous week
        new Date('2026-07-20T10:00:00'), // current week
      ],
      createdAt: [new Date('2026-07-21T10:00:00')],
      now: new Date('2026-07-20T12:00:00'),
    });
    expect(series).toHaveLength(2);
    const prev = series[0]!;
    const curr = series[1]!;
    expect(prev.completed).toBe(2);
    expect(curr.completed).toBe(1);
    expect(curr.created).toBe(1);
  });
});
