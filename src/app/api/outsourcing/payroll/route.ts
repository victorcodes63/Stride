import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const requestedClientId = searchParams.get('clientId') || undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      requestedClientId,
      request,
      ctx.organizationId,
    );
    const departmentId = searchParams.get('departmentId') || undefined;
    const employeeIdsCsv = searchParams.get('employeeIds') || '';
    const employeeIds = employeeIdsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    if (Number.isNaN(m) || m < 1 || m > 12 || Number.isNaN(y)) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
    }

    const payrolls = await ctx.run((tx) =>
      tx.payroll.findMany({
        where: {
          ...ctx.where(),
          month: m,
          year: y,
          ...(employeeIds.length > 0 ? { employeeId: { in: employeeIds } } : {}),
          ...(clientId || departmentId
            ? {
                employee: {
                  ...(clientId ? { outsourcingClientId: clientId } : {}),
                  ...(departmentId ? { departmentId } : {}),
                },
              }
            : {}),
        },
        include: {
          accountsClient: { select: { id: true, name: true } },
          employee: {
            include: {
              client: { select: { id: true, name: true, payrollFrequency: true, leavePayMode: true } },
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          { employee: { lastName: 'asc' } },
          { employee: { firstName: 'asc' } },
        ],
      }),
    );

    const list = payrolls.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      accountsClientId: p.accountsClientId,
      accountsClientName: p.accountsClient?.name ?? null,
      employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
      employeeNumber: p.employee.employeeNumber ?? null,
      clientName: p.employee.client.name,
      payrollFrequency: p.employee.client.payrollFrequency ?? 'monthly',
      leavePayMode: p.employee.client.leavePayMode ?? 'none',
      leavePay: String(p.leavePay ?? 0),
      departmentName: p.employee.department?.name ?? null,
      month: p.month,
      year: p.year,
      basicPay: String(p.basicPay),
      allowances: p.allowances as { name: string; amount: number }[],
      deductions: p.deductions as { name: string; amount: number }[],
      grossPay: String(p.grossPay),
      period1Gross: p.period1Gross != null ? String(p.period1Gross) : null,
      period2Gross: p.period2Gross != null ? String(p.period2Gross) : null,
      biweeklyAttendance: p.biweeklyAttendance ?? null,
      paye: String(p.paye),
      nssf: String(p.nssf),
      nhif: String(p.nhif),
      ahl: String(p.ahl ?? 0),
      nita: String(p.nita ?? 0),
      netPay: String(p.netPay),
      status: p.status,
      attendanceSummaryStatus: 'legacy',
    }));

    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));

    const prismaAny = prisma as unknown as {
      attendanceDaySummary?: {
        aggregate: (args: unknown) => Promise<{
          _count: { _all: number };
          _sum: { minutesWorked: number | null };
        }>;
      };
    };
    const hasSummaryModel = typeof prismaAny.attendanceDaySummary?.aggregate === 'function';

    if (hasSummaryModel) {
      await Promise.all(
        list.map(async (row) => {
          const summary = await prismaAny.attendanceDaySummary!.aggregate({
            where: { employeeId: row.employeeId, workDate: { gte: start, lt: end } },
            _sum: { minutesWorked: true },
            _count: { _all: true },
          });
          (row as Record<string, unknown>).attendanceDays = summary._count._all;
          (row as Record<string, unknown>).attendanceMinutes = summary._sum.minutesWorked ?? 0;
        }),
      );
    } else {
      for (const row of list) {
        (row as Record<string, unknown>).attendanceDays = 0;
        (row as Record<string, unknown>).attendanceMinutes = 0;
      }
    }

    await logAuditEvent({
      actor: { userId: ctx.staff.id, email: ctx.staff.email, name: ctx.staff.name },
      action: 'payroll.records.view',
      entityType: 'PayrollBatch',
      entityId: `${y}-${m}-${clientId ?? 'all'}`,
      route: 'GET /api/outsourcing/payroll',
      metadata: { month: m, year: y, departmentId: departmentId ?? null, count: list.length },
    });

    return NextResponse.json(list);
  });
}
