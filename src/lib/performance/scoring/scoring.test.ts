import { describe, expect, it } from 'vitest';

import { computeBscFinalScore, computeWeightedAverage } from '@/lib/performance/scoring/compute-bsc-score';

describe('BSC scoring', () => {
  it('computes weighted results average', () => {
    const score = computeWeightedAverage([
      { score: 4, weightPercent: 50 },
      { score: 5, weightPercent: 50 },
    ]);
    expect(score).toBe(4.5);
  });

  it('blends results and competencies with cycle weights', () => {
    const final = computeBscFinalScore({
      resultsScore: 4,
      competenciesScore: 3,
      resultsWeightPercent: 70,
      competenciesWeightPercent: 30,
    });
    expect(final).toBe(3.7);
  });
});
