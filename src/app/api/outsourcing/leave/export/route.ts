import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { buildOutsourcedLeaveReport } from '@/lib/leave/leave-report-builders';
import {
  buildLeaveReportPdf,
  buildLeaveReportWorkbook,
  reportFileBase,
  type LeaveReportGroupBy,
  type LeaveReportType,
} from '@/lib/leave/leave-report';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function parseReport(value: string | null): LeaveReportType {
  return value === 'person' || value === 'liability' ? value : 'roster';
}

function parseGroupBy(value: string | null): LeaveReportGroupBy {
  return value === 'group' || value === 'costCenter' || value === 'type' ? value : 'none';
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const format = sp.get('format') === 'xlsx' ? 'xlsx' : 'pdf';
    const report = parseReport(sp.get('report'));
    const groupBy = parseGroupBy(sp.get('groupBy'));
    const personId = sp.get('personId')?.trim() || null;
    const year = parseInt(sp.get('year') || String(new Date().getFullYear()), 10);

    const dataset = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(tx, sp.get('clientId'), request, ctx.organizationId);
      return buildOutsourcedLeaveReport(tx, { organizationId: ctx.organizationId, clientId, year });
    });

    const options = { report, groupBy, personId };
    const base = reportFileBase(dataset, options);

    if (format === 'xlsx') {
      const buffer = Buffer.from(await buildLeaveReportWorkbook(dataset, options));
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${base}.xlsx"`,
          'Content-Length': String(buffer.byteLength),
        },
      });
    }

    const pdf = Buffer.from(await buildLeaveReportPdf(dataset, options));
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${base}.pdf"`,
        'Content-Length': String(pdf.byteLength),
      },
    });
  });
}
