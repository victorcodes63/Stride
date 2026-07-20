import { describe, expect, it } from 'vitest';
import {
  buildTimelineRange,
  compareTasks,
  diffDays,
  layoutBar,
  monthMatrix,
  parseDateOnly,
  toDateKey,
} from './timeline';

describe('timeline helpers', () => {
  it('parses date-only strings', () => {
    expect(parseDateOnly('2026-07-20')?.getDate()).toBe(20);
    expect(parseDateOnly(null)).toBeNull();
  });

  it('builds a padded range covering input dates', () => {
    const range = buildTimelineRange(['2026-07-01', '2026-07-15'], 2);
    expect(toDateKey(range.start)).toBe('2026-06-29');
    expect(toDateKey(range.end)).toBe('2026-07-17');
    expect(range.dayCount).toBe(diffDays(range.start, range.end) + 1);
  });

  it('layouts bars as percentages within the range', () => {
    const range = buildTimelineRange(['2026-07-01', '2026-07-10'], 0);
    const bar = layoutBar(range, '2026-07-01', '2026-07-05');
    expect(bar.undated).toBe(false);
    expect(bar.leftPct).toBeCloseTo(0, 0);
    expect(bar.widthPct).toBeGreaterThan(30);
    expect(bar.widthPct).toBeLessThanOrEqual(100);
  });

  it('marks undated items', () => {
    const range = buildTimelineRange(['2026-07-01'], 0);
    const bar = layoutBar(range, null, null);
    expect(bar.undated).toBe(true);
  });

  it('builds a Sunday-start month matrix', () => {
    // July 2026 starts on Wednesday
    const weeks = monthMatrix(2026, 6);
    expect(weeks[0]?.[0]).toBeNull();
    expect(weeks[0]?.[3]).toBe('2026-07-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('sorts tasks by priority', () => {
    const a = { title: 'A', status: 'todo', priority: 'high', dueDate: null };
    const b = { title: 'B', status: 'todo', priority: 'low', dueDate: null };
    expect(compareTasks(a, b, 'priority', 'asc')).toBeLessThan(0);
    expect(compareTasks(a, b, 'priority', 'desc')).toBeGreaterThan(0);
  });
});
