import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import {
  downloadHeaders,
  jsonOrPdf,
  parseDateParam,
  parseFormat,
  requireReportsUser,
  startOfDayUtc,
  ymd,
} from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const from = startOfDayUtc(parseDateParam(request.nextUrl.searchParams.get('from'), defaultFrom));
  const to = startOfDayUtc(parseDateParam(request.nextUrl.searchParams.get('to'), now));
  const format = parseFormat(request);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const applications = await prisma.leaveApplication.findMany({
    where: {
      employee: { outsourcingClientId: workspaceClientId },
      startDate: { lte: to },
      endDate: { gte: from },
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { name: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const byStatus = new Map<string, number>();
  const byType = new Map<string, number>();
  let totalDays = 0;

  const details = applications.map((row) => {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    const typeName = row.leaveType?.name ?? 'Leave';
    byType.set(typeName, (byType.get(typeName) ?? 0) + 1);
    totalDays += row.days;

    return {
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber ?? '',
      department: row.employee.department?.name ?? 'Unassigned',
      leaveType: typeName,
      startDate: ymd(row.startDate),
      endDate: ymd(row.endDate),
      days: row.days,
      status: row.status,
    };
  });

  const report = {
    from: ymd(from),
    to: ymd(to),
    totalApplications: applications.length,
    totalDays,
    pending: applications.filter((a) => a.status === 'pending').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
    details,
  };

  if (format === 'csv') {
    const csv = toCSV(
      ['Employee', 'Employee No.', 'Department', 'Leave type', 'Start', 'End', 'Days', 'Status'],
      report.details.map((row) => [
        row.employeeName,
        row.employeeNumber,
        row.department,
        row.leaveType,
        row.startDate,
        row.endDate,
        row.days,
        row.status,
      ]),
    );
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `leave-${ymd(from)}-to-${ymd(to)}.csv`),
    });
  }

  return jsonOrPdf(format, report, 'Leave Report', `leave-${ymd(from)}-to-${ymd(to)}.pdf`, [
    `Period: ${report.from} to ${report.to}`,
    `Applications: ${report.totalApplications}`,
    `Total days: ${report.totalDays}`,
    `Pending: ${report.pending}`,
    `Approved: ${report.approved}`,
    `Rejected: ${report.rejected}`,
  ]);
}
