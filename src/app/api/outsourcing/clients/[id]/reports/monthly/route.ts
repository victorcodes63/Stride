import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import {
  buildOutsourcingMonthlyReport,
  renderOutsourcingReportHtml,
} from '@/lib/outsourcing-client-reports';
import { generateOutsourcingReportPdf } from '@/lib/outsourcing-report-pdf';

export const dynamic = 'force-dynamic';

function parsePeriod(searchParams: URLSearchParams) {
  const now = new Date();
  const month = parseInt(searchParams.get('month') ?? String(now.getUTCMonth() + 1), 10);
  const year = parseInt(searchParams.get('year') ?? String(now.getUTCFullYear()), 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
  return { month, year };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    try {
      const { id } = await context.params;
      const period = parsePeriod(ctx.request.nextUrl.searchParams);
      if (!period) {
        return NextResponse.json({ error: 'Valid month and year are required.' }, { status: 400 });
      }

      const format = ctx.request.nextUrl.searchParams.get('format')?.toLowerCase() ?? 'json';

      const report = await ctx.run((tx) =>
        buildOutsourcingMonthlyReport(tx, {
          organizationId: ctx.organizationId,
          outsourcingClientId: id,
          month: period.month,
          year: period.year,
        }),
      );

      if (format === 'html') {
        const html = renderOutsourcingReportHtml(report);
        return new NextResponse(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `inline; filename="workforce-report-${id}-${period.year}-${period.month}.html"`,
          },
        });
      }

      if (format === 'pdf') {
        const pdfBytes = await generateOutsourcingReportPdf(report);
        return new NextResponse(Buffer.from(pdfBytes), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="workforce-report-${id}-${period.year}-${period.month}.pdf"`,
          },
        });
      }

      return NextResponse.json(report);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'OUTSOURCING_CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'End-client not found.' }, { status: 404 });
      }
      await reportApiError({
        route: 'GET /api/outsourcing/clients/[id]/reports/monthly',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to build report.' }, { status: 500 });
    }
  });
}
