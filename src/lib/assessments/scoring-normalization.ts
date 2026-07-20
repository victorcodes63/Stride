import type { QuestionScoringConfig } from '@/lib/assessments/types';

export type DimensionQuestion = {
  scoring: QuestionScoringConfig | null | undefined;
  /** Candidate's numeric answer (likert/rating value). */
  value: number | null;
};

/**
 * Compute 0-100 dimension scores from likert/rating/situational answers.
 * Reverse-keyed items are inverted. Returns {} when there are no dimension items.
 */
export function computeDimensionScores(items: DimensionQuestion[]): Record<string, number> {
  const acc = new Map<string, { sum: number; count: number }>();

  for (const item of items) {
    const dimension = item.scoring?.dimension;
    if (!dimension || item.value === null || Number.isNaN(item.value)) continue;
    const scale = item.scoring?.scale ?? 5;
    let value = item.value;
    if (item.scoring?.reverse) value = scale + 1 - value;
    // Normalise to 0-100 within the scale (1..scale -> 0..100).
    const normalized = ((value - 1) / Math.max(1, scale - 1)) * 100;
    const bucket = acc.get(dimension) ?? { sum: 0, count: 0 };
    bucket.sum += clamp(normalized, 0, 100);
    bucket.count += 1;
    acc.set(dimension, bucket);
  }

  const result: Record<string, number> = {};
  for (const [dimension, { sum, count }] of acc) {
    if (count > 0) result[dimension] = Math.round((sum / count) * 100) / 100;
  }
  return result;
}

/** Convert a 0-100 percentage into a Sten score (1-10) using a linear map. */
export function percentToSten(percent: number): number {
  const sten = Math.round((percent / 100) * 9) + 1;
  return clamp(sten, 1, 10);
}

/**
 * Approximate a percentile from a raw percent using a logistic curve centred at 50%.
 * When benchmark data is available it should replace this; this is a sane default.
 */
export function percentToPercentile(percent: number): number {
  const x = (percent - 50) / 15;
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(clamp(logistic * 100, 1, 99));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
