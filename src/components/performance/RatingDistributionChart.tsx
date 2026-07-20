'use client';

import { HorizontalBarChart, type HBarDatum, type ChartTone } from '@/components/onboarding/AnalyticsCharts';

export type DistributionBucket = { label: string; count: number };

/** Maps the 1–5 rating label to a chart tone (band 5 highest → coral, band 1 → danger). */
function bandTone(label: string): ChartTone {
  const band = Number(label.trim().charAt(0));
  if (band >= 4) return 'primary';
  if (band === 3) return 'primarySoft';
  if (band === 2) return 'neutral';
  return 'danger';
}

/** Rating distribution as labelled horizontal bars, reusing the shared chart primitive. */
export function RatingDistributionChart({
  distribution,
  total,
}: {
  distribution: DistributionBucket[];
  total?: number;
}) {
  const sum = total ?? distribution.reduce((acc, b) => acc + b.count, 0);
  const data: HBarDatum[] = distribution.map((b) => ({
    label: b.label,
    value: b.count,
    tone: bandTone(b.label),
    hint: sum > 0 ? `${Math.round((b.count / sum) * 100)}%` : undefined,
  }));

  return (
    <HorizontalBarChart
      data={data}
      emptyLabel="No finalized ratings yet."
      formatValue={(value) => (sum > 0 ? `${value} · ${Math.round((value / sum) * 100)}%` : String(value))}
    />
  );
}
