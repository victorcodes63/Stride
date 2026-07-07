export const SLOW_QUERY_THRESHOLD_MS = 100;

export type SlowQueryAggregate = {
  route: string;
  query: string;
  maxMs: number;
  count: number;
  totalMs: number;
};

export type RouteTimingAggregate = {
  route: string;
  totalMs: number;
  count: number;
  maxMs: number;
  avgMs: number;
  slowQueryCount: number;
};

/** Enabled in local dev and Vercel preview/staging — never in production. */
export function isQueryTimingEnabled(): boolean {
  if (process.env.PRISMA_QUERY_TIMING === '1') return true;
  if (process.env.PRISMA_QUERY_TIMING === '0') return false;
  if (process.env.NODE_ENV === 'development') return true;
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv === 'preview' || vercelEnv === 'development';
}

export function formatSlowQueryReportMarkdown(report: {
  thresholdMs: number;
  generatedAt: string;
  slowQueryEventCount: number;
  rankedQueries: SlowQueryAggregate[];
  rankedRoutes: RouteTimingAggregate[];
}): string {
  const lines: string[] = [
    `## SPD-00 slow query report (${report.generatedAt})`,
    '',
    `Threshold: **>${report.thresholdMs}ms** · Events: **${report.slowQueryEventCount}**`,
    '',
    '### Slowest routes (by max query latency)',
    '',
    '| Rank | Route | Max (ms) | Avg (ms) | Slow queries |',
    '| --- | --- | ---: | ---: | ---: |',
  ];

  report.rankedRoutes.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | \`${row.route}\` | ${row.maxMs} | ${row.avgMs} | ${row.slowQueryCount} |`,
    );
  });

  lines.push('', '### Slowest queries', '', '| Rank | Route | Max (ms) | Count | Query (truncated) |', '| --- | --- | ---: | ---: | --- |');

  report.rankedQueries.forEach((row, index) => {
    const query = row.query.replace(/\s+/g, ' ').slice(0, 120);
    lines.push(`| ${index + 1} | \`${row.route}\` | ${row.maxMs} | ${row.count} | \`${query}\` |`);
  });

  return lines.join('\n');
}
