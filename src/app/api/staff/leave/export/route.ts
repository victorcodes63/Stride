import { NextRequest, NextResponse } from 'next/server';
import { canAccessTeamLeaveScope } from '@/lib/staff-api-auth';
import { getTeamLeaveMemberIds } from '@/lib/staff-leave-team';
import { syncStaffLeaveUsedDaysForUsersYear } from '@/lib/staff-leave-balance';
import { buildStaffLeaveReport } from '@/lib/leave/leave-report-builders';
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
    if (!canAccessTeamLeaveScope(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const format = sp.get('format') === 'xlsx' ? 'xlsx' : 'pdf';
    const report = parseReport(sp.get('report'));
    const groupBy = parseGroupBy(sp.get('groupBy'));
    const personId = sp.get('personId')?.trim() || null;
    const year = parseInt(sp.get('year') || String(new Date().getFullYear()), 10);

    const memberIds = await getTeamLeaveMemberIds(ctx.staff);

    const dataset = await ctx.run(async (tx) => {
      if (memberIds.length > 0) await syncStaffLeaveUsedDaysForUsersYear(tx, memberIds, year);
      return buildStaffLeaveReport(tx, { organizationId: ctx.organizationId, memberIds, year });
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
