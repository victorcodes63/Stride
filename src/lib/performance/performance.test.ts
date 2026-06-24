import { describe, expect, it } from 'vitest';

import { ratingLabel, DEFAULT_RATING_DIMENSIONS } from '@/lib/performance/service';

describe('performance service', () => {
  it('maps scores to labels', () => {
    expect(ratingLabel(5)).toBe('Exceptional');
    expect(ratingLabel(3)).toBe('Meets expectations');
    expect(ratingLabel(null)).toBe('Not rated');
  });

  it('defines default rating dimensions', () => {
    expect(DEFAULT_RATING_DIMENSIONS.length).toBeGreaterThanOrEqual(4);
  });
});
