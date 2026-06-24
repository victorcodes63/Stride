import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import { isBiweeklyClient } from '@/lib/biweekly-payroll';
import { mapOutsourcingClientsToAccountsClients } from '@/lib/payroll-accounts-link';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { ATTENDANCE_SUMMARY_STATUSES_FOR_PAYROLL } from '@/lib/attendance-reconciliation';
import { logAuditEvent } from '@/lib/audit-events';
import { createWorkflowRun, getPayrollUserIds, sendNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const month = typeof b.month === 'number' ? b.month : parseInt(String(b.month ?? ''), 10);
    const year = typeof b.year === 'number' ? b.year : parseInt(String(b.year ?? ''), 10);
    const requestedClientId = typeof b.clientId === 'string' && b.clientId.trim() ? b.clientId.trim() : null;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const departmentId = typeof b.departmentId === 'string' && b.departmentId.trim() ? b.departmentId.trim() : null;
    const defaultLeavePay =
      typeof b.defaultLeavePay === 'number' && !Number.isNaN(b.defaultLeavePay)
        ? Math.max(0, b.defaultLeavePay)
        : typeof b.defaultLeavePay === 'string'
          ? Math.max(0, parseFloat(b.defaultLeavePay) || 0)
          : 0;

    if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
      return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 });
    }

    let biweekly = false;
    let leavePayMode: string | null = 'none';
    const c = await prisma.outsourcingClient.findUnique({
      where: { id: clientId },
      select: { payrollFrequency: true, leavePayMode: true },
    });
    biweekly = isBiweeklyClient(c?.payrollFrequency);
    leavePayMode = c?.leavePayMode ?? 'none';

    const employees = await prisma.employee.findMany({
      where: {
        outsourcingClientId: clientId,
        ...(departmentId ? { departmentId } : {}),
      },
      select: { id: true, baseSalary: true, outsourcingClientId: true },
    });

    const accountsByOutsourcing = await mapOutsourcingClientsToAccountsClients(
      employees.map((e) => e.outsourcingClientId),
    );

    const clientModes = new Map<string, string | null>();
    if (!clientId && employees.length) {
      const clientIds = [...new Set(employees.map((e) => e.outsourcingClientId))];
      const clients = await prisma.outsourcingClient.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, leavePayMode: true, payrollFrequency: true },
      });
      for (const c of clients) {
        clientModes.set(c.id, c.leavePayMode);
      }
    }

    const existing = await prisma.payroll.findMany({
      where: {
        month,
        year,
        employeeId: { in: employees.map((e) => e.id) },
      },
      select: { employeeId: true },
    });
    const existingIds = new Set(existing.map((e) => e.employeeId));
    const toCreate = employees.filter((e) => !existingIds.has(e.id));

    if (toCreate.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: employees.length,
        message: 'All employees in scope already have payroll records for this month.',
      });
    }

    /** Use interactive transaction — `.$transaction([ async () => ... ])` is not a supported Prisma batch shape. */
    await prisma.$transaction(async (tx) => {
      const periodStart = new Date(Date.UTC(year, month - 1, 1));
      const periodEnd = new Date(Date.UTC(year, month, 1));
      for (const e of toCreate) {
        const mode =
          clientId ? leavePayMode : clientModes.get(e.outsourcingClientId) ?? 'none';
        const basic = e.baseSalary != null ? Number(e.baseSalary) : 0;
        const attendanceAggregate = await tx.attendanceDaySummary.aggregate({
          where: {
            employeeId: e.id,
            workDate: { gte: periodStart, lt: periodEnd },
            status: { in: [...ATTENDANCE_SUMMARY_STATUSES_FOR_PAYROLL] },
          },
          _sum: { overtimeMinutes: true, holidayOvertimeMinutes: true },
        });
        const overtimeMinutes = attendanceAggregate._sum.overtimeMinutes ?? 0;
        const holidayOvertimeMinutes = attendanceAggregate._sum.holidayOvertimeMinutes ?? 0;
        const regularOvertimeMinutes = Math.max(0, overtimeMinutes - holidayOvertimeMinutes);
        const hourlyRate = basic > 0 ? basic / (26 * 8) : 0;
        const regularOvertimeAmount =
          Math.round((regularOvertimeMinutes / 60) * hourlyRate * 1.5 * 100) / 100;
        const holidayOvertimeAmount =
          Math.round((holidayOvertimeMinutes / 60) * hourlyRate * 2.0 * 100) / 100;
        const overtimeAmount = regularOvertimeAmount + holidayOvertimeAmount;
        const overtimeAllowance = [
          ...(regularOvertimeAmount > 0
            ? [
                {
                  name: `Overtime 1.5x (${(regularOvertimeMinutes / 60).toFixed(2)}h)`,
                  amount: regularOvertimeAmount,
                },
              ]
            : []),
          ...(holidayOvertimeAmount > 0
            ? [
                {
                  name: `Public holiday overtime (2x) (${(holidayOvertimeMinutes / 60).toFixed(2)}h)`,
                  amount: holidayOvertimeAmount,
                },
              ]
            : []),
        ];
        const lp =
          mode === 'included_in_gross' || mode === 'paye_only' ? defaultLeavePay : 0;
        if (biweekly && clientId && basic > 0) {
          const half = Math.round(basic / 2);
          const other = basic - half;
          const employmentGross = half + other + overtimeAmount;
          const stat = calculateStatutoryForPayroll(mode, employmentGross, lp, 0);
          await tx.payroll.create({
            data: {
              employeeId: e.id,
              month,
              year,
              accountsClientId: accountsByOutsourcing.get(e.outsourcingClientId) ?? null,
              basicPay: new Decimal(employmentGross),
              period1Gross: new Decimal(half),
              period2Gross: new Decimal(other),
              grossPay: new Decimal(stat.grossPay),
              leavePay: new Decimal(lp),
              paye: new Decimal(stat.paye),
              nssf: new Decimal(stat.nssf),
              nhif: new Decimal(stat.nhif),
              ahl: new Decimal(stat.ahl),
              nita: new Decimal(stat.nita),
              netPay: new Decimal(stat.netPay),
              allowances: overtimeAllowance,
              deductions: [],
            },
          });
        } else {
          const employmentGross = basic + overtimeAmount;
          const stat = calculateStatutoryForPayroll(mode, employmentGross, lp, 0);
          await tx.payroll.create({
            data: {
              employeeId: e.id,
              month,
              year,
              accountsClientId: accountsByOutsourcing.get(e.outsourcingClientId) ?? null,
              basicPay: new Decimal(basic),
              grossPay: new Decimal(stat.grossPay),
              leavePay: new Decimal(lp),
              paye: new Decimal(stat.paye),
              nssf: new Decimal(stat.nssf),
              nhif: new Decimal(stat.nhif),
              ahl: new Decimal(stat.ahl),
              nita: new Decimal(stat.nita),
              netPay: new Decimal(stat.netPay),
              allowances: overtimeAllowance,
              deductions: [],
            },
          });
        }
      }
    });
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'payroll.generated',
      entityType: 'PayrollBatch',
      entityId: `${year}-${month}-${clientId}`,
      route: 'POST /api/outsourcing/payroll/generate',
      metadata: {
        month,
        year,
        clientId,
        departmentId,
        created: toCreate.length,
        skipped: employees.length - toCreate.length,
      },
    });
    try {
      const payrollUserIds = await getPayrollUserIds();
      const workflow = await createWorkflowRun({
        module: 'payroll',
        event: 'payroll_generated',
        entityType: 'PayrollBatch',
        entityId: `${year}-${month}-${clientId}`,
        entityCode: clientId ? (await prisma.outsourcingClient.findUnique({ where: { id: clientId }, select: { entityCode: true } }))?.entityCode ?? null : null,
        assigneeUserId: payrollUserIds[0] ?? null,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: { month, year, clientId, created: toCreate.length },
      });
      await sendNotification({
        event: 'payroll_generated',
        recipientUserIds: payrollUserIds,
        title: 'Payroll draft ready',
        body: `${month}/${year} payroll has been generated and is ready for review.`,
        href: '/dashboard/outsourcing/payroll',
        priority: 'info',
        channel: 'in_app',
        workflowRunId: workflow.id,
        metadata: { month, year, clientId, workflowRunId: workflow.id },
      });
    } catch (err) {
      console.error('[notifications] Failed to send payroll_generated:', err);
    }

    return NextResponse.json({
      created: toCreate.length,
      skipped: employees.length - toCreate.length,
      message: `Created ${toCreate.length} draft payroll record(s) for ${month}/${year}.${biweekly ? ' (Bi-weekly)' : ''}`,
    });
  } catch (e) {
    console.error('[payroll/generate]', e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Failed to generate payroll', detail }, { status: 500 });
  }
}
