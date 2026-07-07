import { describe, expect, it } from 'vitest';

import { buildNineBoxGrid, buildRatingDistribution } from '@/lib/performance/reporting/analytics';

describe('performance analytics', () => {
  it('builds rating distribution buckets', () => {
    const distribution = buildRatingDistribution([
      { overallManagerRating: 5, finalBlendedScore: 4.8 },
      { overallManagerRating: 3, finalBlendedScore: 3.1 },
      { overallManagerRating: null, finalBlendedScore: null },
    ]);
    expect(distribution.some((b) => b.count >= 1)).toBe(true);
  });

  it('builds a 9-box grid', () => {
    const grid = buildNineBoxGrid([
      {
        employeeName: 'Jane Doe',
        finalResultsScore: 4.2,
        finalCompetenciesScore: 3.8,
      },
    ]);
    expect(grid).toHaveLength(9);
    expect(grid.reduce((sum, cell) => sum + cell.count, 0)).toBe(1);
  });
});
