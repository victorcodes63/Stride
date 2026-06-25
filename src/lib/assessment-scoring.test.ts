import { describe, expect, it } from 'vitest';
import { computeScorePercent, scoreAssessmentAnswer } from './assessment-scoring';

describe('assessment-scoring (RAV-124)', () => {
  it('scores MCQ answers', () => {
    const ok = scoreAssessmentAnswer('mcq', { value: 'b' }, 'b', 2);
    expect(ok.isCorrect).toBe(true);
    expect(ok.pointsAwarded).toBe(2);
  });

  it('scores numeric answers with tolerance', () => {
    const ok = scoreAssessmentAnswer('numeric', { value: 100 }, 100.05, 1);
    expect(ok.isCorrect).toBe(true);
  });

  it('computes percentage', () => {
    expect(computeScorePercent(7, 10)).toBe(70);
  });
});
