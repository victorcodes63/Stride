import { NextRequest, NextResponse } from 'next/server';
import {
  formatSlowQueryReportMarkdown,
  isQueryTimingEnabled,
} from '@/lib/perf/query-timing';
import {
  getSlowQueryReport,
  resetSlowQueryStats,
} from '@/lib/perf/query-timing-store';

export const dynamic = 'force-dynamic';

function devOnlyResponse(): NextResponse | null {
  if (isQueryTimingEnabled()) return null;
  return NextResponse.json({ error: 'Query timing is disabled in this environment.' }, { status: 404 });
}

/** GET — return aggregated slow-query report (dev/staging only). */
export async function GET() {
  const blocked = devOnlyResponse();
  if (blocked) return blocked;
  const report = getSlowQueryReport();
  return NextResponse.json(report);
}

/** POST — reset counters; optional `?format=markdown` returns formatted report body. */
export async function POST(request: NextRequest) {
  const blocked = devOnlyResponse();
  if (blocked) return blocked;

  const action = request.nextUrl.searchParams.get('action');
  if (action === 'reset') {
    resetSlowQueryStats();
    return NextResponse.json({ ok: true, reset: true });
  }

  const report = getSlowQueryReport();
  if (request.nextUrl.searchParams.get('format') === 'markdown') {
    return new NextResponse(formatSlowQueryReportMarkdown(report), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  return NextResponse.json(report);
}
