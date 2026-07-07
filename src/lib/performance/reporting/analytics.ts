import type { PerformanceReviewDto } from '@/lib/performance/service';

export type RatingDistributionBucket = {
  label: string;
  count: number;
};

export type NineBoxCell = {
  resultsBand: 'low' | 'mid' | 'high';
  competencyBand: 'low' | 'mid' | 'high';
  count: number;
  employees: string[];
};

function bandScore(score: number | null | undefined): 'low' | 'mid' | 'high' | null {
  if (score == null) return null;
  if (score < 2.5) return 'low';
  if (score < 3.5) return 'mid';
  return 'high';
}

export function buildRatingDistribution(
  reviews: Array<{ overallManagerRating: number | null; finalBlendedScore?: number | null }>,
): RatingDistributionBucket[] {
  const buckets = [
    { label: '1 — Unsatisfactory', min: 1, max: 1.49, count: 0 },
    { label: '2 — Needs improvement', min: 1.5, max: 2.49, count: 0 },
    { label: '3 — Meets expectations', min: 2.5, max: 3.49, count: 0 },
    { label: '4 — Exceeds expectations', min: 3.5, max: 4.49, count: 0 },
    { label: '5 — Exceptional', min: 4.5, max: 5.01, count: 0 },
  ];

  for (const review of reviews) {
    const score = review.finalBlendedScore ?? review.overallManagerRating;
    if (score == null) continue;
    const bucket = buckets.find((b) => score >= b.min && score < b.max);
    if (bucket) bucket.count += 1;
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}

export function buildNineBoxGrid(
  reviews: Array<{
    employeeName: string;
    finalResultsScore?: number | null;
    finalCompetenciesScore?: number | null;
    overallManagerRating?: number | null;
  }>,
): NineBoxCell[] {
  const cells: NineBoxCell[] = [];
  for (const resultsBand of ['low', 'mid', 'high'] as const) {
    for (const competencyBand of ['low', 'mid', 'high'] as const) {
      cells.push({ resultsBand, competencyBand, count: 0, employees: [] });
    }
  }

  for (const review of reviews) {
    const results = bandScore(review.finalResultsScore ?? review.overallManagerRating);
    const competencies = bandScore(review.finalCompetenciesScore ?? review.overallManagerRating);
    if (!results || !competencies) continue;
    const cell = cells.find((c) => c.resultsBand === results && c.competencyBand === competencies);
    if (cell) {
      cell.count += 1;
      cell.employees.push(review.employeeName);
    }
  }

  return cells;
}

export function enrichReviewAnalytics(reviews: PerformanceReviewDto[]) {
  return {
    distribution: buildRatingDistribution(reviews),
    nineBox: buildNineBoxGrid(reviews),
  };
}
