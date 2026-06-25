import { describe, expect, it } from 'vitest';
import {
  deptMatches,
  monthInRange,
  resolveProjectPeriod,
  sumActuals,
} from '@/lib/projects/project-budget';

describe('project-budget helpers', () => {
  it('matches departments case-insensitively', () => {
    expect(deptMatches('Operations', 'operations')).toBe(true);
    expect(deptMatches('Finance', 'HR')).toBe(false);
    expect(deptMatches(null, 'HR')).toBe(false);
  });

  it('resolves project period with defaults', () => {
    const now = new Date('2026-06-15');
    const { start, end } = resolveProjectPeriod(null, null, now);
    expect(start.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(end.toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  it('checks payroll month in range', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-03-31');
    expect(monthInRange(2026, 2, start, end)).toBe(true);
    expect(monthInRange(2026, 5, start, end)).toBe(false);
  });

  it('sums actuals', () => {
    expect(sumActuals({ payroll: 100, accountsPayable: 50, expenses: 25 })).toBe(175);
  });
});
