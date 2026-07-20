/**
 * Weighted competency fit: combine a candidate's dimension scores (0-100) with a
 * job's dimension weights to produce a single 0-100 fit score. Dimensions the job
 * cares about but the candidate has no score for are treated as 0 (missing signal).
 */
export function computeFitScore(
  dimensionScores: Record<string, number>,
  weights: Record<string, number>,
): number | null {
  const entries = Object.entries(weights).filter(([, w]) => Number(w) > 0);
  if (entries.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [dimension, weight] of entries) {
    const w = Number(weight);
    const score = Number(dimensionScores[dimension] ?? 0);
    weightedSum += score * w;
    totalWeight += w;
  }
  if (totalWeight <= 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/** Per-dimension gap vs the job target band (for reporting). */
export function computeTargetGaps(
  dimensionScores: Record<string, number>,
  targets: Record<string, { min?: number; max?: number }>,
): Record<string, { score: number; status: 'below' | 'within' | 'above' }> {
  const out: Record<string, { score: number; status: 'below' | 'within' | 'above' }> = {};
  for (const [dimension, band] of Object.entries(targets)) {
    const score = Number(dimensionScores[dimension] ?? 0);
    let status: 'below' | 'within' | 'above' = 'within';
    if (band.min !== undefined && score < band.min) status = 'below';
    else if (band.max !== undefined && score > band.max) status = 'above';
    out[dimension] = { score, status };
  }
  return out;
}
