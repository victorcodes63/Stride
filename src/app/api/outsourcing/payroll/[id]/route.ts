import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import { allocateStatutoryBiweekly, isBiweeklyClient } from '@/lib/biweekly-payroll';
import {
  normalizeAttendance,
  proRatedPeriodGrosses,
  workingDaysInPeriod,
} from '@/lib/biweekly-attendance';
import { mapOutsourcingClientsToAccountsClients } from '@/lib/payroll-accounts-link';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { ATTENDANCE_SUMMARY_STATUSES_FOR_PAYROLL } from '@/lib/attendance-reconciliation';
import { logAuditEvent } from '@/lib/audit-events';
import { getPayrollUserIds, sendNotification, transitionWorkflowRun } from '@/lib/notifications';
import { enforceSodCheck, requireRecentSensitiveAuth, SodViolationError } from '@/lib/admin-security';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStaffUser(_request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    const id = (await params).id;
    const p = await prisma.payroll.findUnique({
      where: { id },
      include: {
        accountsClient: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            outsourcingClientId: true,
            client: { select: { name: true, payrollFrequency: true, leavePayMode: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
    if (!p) return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });
    const allowances = (p.allowances as { name: string; amount: number }[]) ?? [];
    const deductions = (p.deductions as { name: string; amount: number }[]) ?? [];
    const g1 = p.period1Gross != null ? Number(p.period1Gross) : null;
    const g2 = p.period2Gross != null ? Number(p.period2Gross) : null;
    const biweekly =
      isBiweeklyClient(p.employee.client.payrollFrequency) && g1 != null && g2 != null && g1 + g2 > 0;
    let biweeklyAllocation = null as ReturnType<typeof allocateStatutoryBiweekly> | null;
    if (biweekly) {
      biweeklyAllocation = allocateStatutoryBiweekly(g1, g2, {
        paye: Number(p.paye),
        nssf: Number(p.nssf),
        shif: Number(p.nhif),
        ahl: Number(p.ahl),
      });
    }
    const biweeklyAttendance = normalizeAttendance(
      p.biweeklyAttendance,
      p.year,
      p.month
    );
    const periodStart = new Date(Date.UTC(p.year, p.month - 1, 1));
    const periodEnd = new Date(Date.UTC(p.year, p.month, 1));
    const attendanceSummary = await prisma.attendanceDaySummary.aggregate({
      where: { employeeId: p.employeeId, workDate: { gte: periodStart, lt: periodEnd } },
      _count: { _all: true },
      _sum: { minutesWorked: true, lateMinutes: true },
    });
    const overtimeEligible = await prisma.attendanceDaySummary.aggregate({
      where: {
        employeeId: p.employeeId,
        workDate: { gte: periodStart, lt: periodEnd },
        status: { in: [...ATTENDANCE_SUMMARY_STATUSES_FOR_PAYROLL] },
      },
      _sum: { overtimeMinutes: true },
    });
    return NextResponse.json({
      id: p.id,
      employeeId: p.employeeId,
      employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
      employeeNumber: p.employee.employeeNumber,
      clientName: p.employee.client.name,
      payrollFrequency: p.employee.client.payrollFrequency ?? 'monthly',
      leavePayMode: p.employee.client.leavePayMode ?? 'none',
      leavePay: String(p.leavePay ?? 0),
      departmentName: p.employee.department?.name,
      month: p.month,
      year: p.year,
      basicPay: String(p.basicPay),
      period1Gross: p.period1Gross != null ? String(p.period1Gross) : null,
      period2Gross: p.period2Gross != null ? String(p.period2Gross) : null,
      allowances,
      deductions,
      grossPay: String(p.grossPay),
      paye: String(p.paye),
      nssf: String(p.nssf),
      nhif: String(p.nhif),
      ahl: String(p.ahl ?? 0),
      nita: String(p.nita ?? 0),
      netPay: String(p.netPay),
      status: p.status,
      biweeklyAllocation,
      biweeklyAttendance,
      biweeklyWorkingDays: biweekly
        ? {
            period1: workingDaysInPeriod(p.year, p.month, 1).length,
            period2: workingDaysInPeriod(p.year, p.month, 2).length,
          }
        : null,
      accountsClientId: p.accountsClientId,
      accountsClientName: p.accountsClient?.name ?? null,
      reconciledAttendance: {
        days: attendanceSummary._count._all,
        minutesWorked: attendanceSummary._sum.minutesWorked ?? 0,
        overtimeMinutes: overtimeEligible._sum.overtimeMinutes ?? 0,
        lateMinutes: attendanceSummary._sum.lateMinutes ?? 0,
      },
    });
  } catch (e) {
    console.error('[payroll GET id]', e);
    return NextResponse.json({ error: 'Failed to load payroll' }, { status: 500 });
  }
}

function toDecimal(v: unknown): Decimal {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')) || 0;
  return new Decimal(Math.round(n * 100) / 100);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    const id = (await params).id;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const basicPay = body.basicPay != null ? toDecimal(body.basicPay) : undefined;
    const period1Gross =
      body.period1Gross != null ? toDecimal(body.period1Gross) : undefined;
    const period2Gross =
      body.period2Gross != null ? toDecimal(body.period2Gross) : undefined;
    const allowances = Array.isArray(body.allowances)
      ? (body.allowances as { name: string; amount: number }[]).filter(
          (a) => typeof a?.name === 'string' && typeof a?.amount === 'number'
        )
      : undefined;
    const deductions = Array.isArray(body.deductions)
      ? (body.deductions as { name: string; amount: number }[]).filter(
          (d) => typeof d?.name === 'string' && typeof d?.amount === 'number'
        )
      : undefined;
    const payeOverride = body.paye != null ? toDecimal(body.paye) : undefined;
    const nssfOverride = body.nssf != null ? toDecimal(body.nssf) : undefined;
    const nhifOverride = body.nhif != null ? toDecimal(body.nhif) : undefined;
    const ahlOverride = body.ahl != null ? toDecimal(body.ahl) : undefined;
    const leavePayBody = body.leavePay != null ? toDecimal(body.leavePay) : undefined;
    let recalculateStatutory = body.recalculateStatutory === true;
    const proRateBiweekly = body.proRateBiweeklyFromAttendance === true;
    const statusOverride =
      body.status === 'draft' || body.status === 'approved' || body.status === 'paid'
        ? body.status
        : undefined;

    const existing = await prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            outsourcingClientId: true,
            client: { select: { payrollFrequency: true, leavePayMode: true } },
          },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });

    const biweeklyMode =
      isBiweeklyClient(existing.employee.client.payrollFrequency) ||
      existing.period1Gross != null ||
      existing.period2Gross != null;

    let p1 =
      period1Gross != null
        ? Number(period1Gross)
        : existing.period1Gross != null
          ? Number(existing.period1Gross)
          : null;
    let p2 =
      period2Gross != null
        ? Number(period2Gross)
        : existing.period2Gross != null
          ? Number(existing.period2Gross)
          : null;

    const attendanceNorm = normalizeAttendance(
      body.biweeklyAttendance !== undefined ? body.biweeklyAttendance : existing.biweeklyAttendance,
      existing.year,
      existing.month
    );
    if (
      proRateBiweekly &&
      biweeklyMode &&
      (attendanceNorm.period1.length > 0 || attendanceNorm.period2.length > 0)
    ) {
      const monthlyBasic = Number(existing.basicPay);
      const pr = proRatedPeriodGrosses({
        year: existing.year,
        month: existing.month,
        attendance: attendanceNorm,
        monthlyBasic,
      });
      p1 = pr.period1Gross;
      p2 = pr.period2Gross;
      recalculateStatutory = true;
    }

    const allowancesVal = allowances ?? (existing.allowances as { name: string; amount: number }[]) ?? [];
    const deductionsVal = deductions ?? (existing.deductions as { name: string; amount: number }[]) ?? [];
    const allowancesTotal = allowancesVal.reduce((s, a) => s + (a?.amount ?? 0), 0);
    const otherDeductionsTotal = deductionsVal.reduce((s, d) => s + (d?.amount ?? 0), 0);

    const employmentGross =
      biweeklyMode && p1 != null && p2 != null
        ? p1 + p2 + allowancesTotal
        : (basicPay != null ? Number(basicPay) : Number(existing.basicPay)) + allowancesTotal;
    const leavePayNum =
      leavePayBody != null ? Number(leavePayBody) : Number(existing.leavePay ?? 0);
    const leavePayMode = existing.employee.client.leavePayMode ?? 'none';
    // included_in_gross: recalc so NSSF/SHIF/AHL/PAYE match full gross. paye_only: recalc so NSSF/SHIF/AHL stay on employment only.
    if (
      !recalculateStatutory &&
      leavePayNum > 0 &&
      (leavePayMode === 'included_in_gross' || leavePayMode === 'paye_only')
    ) {
      recalculateStatutory = true;
    }
    if (!recalculateStatutory && leavePayBody != null && leavePayMode === 'included_in_gross') {
      recalculateStatutory = true;
    }
    const storedGrossPay =
      leavePayMode === 'none'
        ? employmentGross
        : employmentGross + leavePayNum;

    let paye: Decimal;
    let nssf: Decimal;
    let nhif: Decimal;
    let ahl: Decimal;
    let nita: Decimal;
    let netPay: Decimal;

    if (recalculateStatutory) {
      const calc = calculateStatutoryForPayroll(
        leavePayMode,
        biweeklyMode && p1 != null && p2 != null ? p1 + p2 + allowancesTotal : Number(existing.basicPay) + allowancesTotal,
        leavePayNum,
        otherDeductionsTotal
      );
      paye = toDecimal(calc.paye);
      nssf = toDecimal(calc.nssf);
      nhif = toDecimal(calc.nhif);
      ahl = toDecimal(calc.ahl);
      nita = toDecimal(calc.nita);
      netPay = toDecimal(calc.netPay);
    } else {
      paye = payeOverride ?? existing.paye;
      nssf = nssfOverride ?? existing.nssf;
      nhif = nhifOverride ?? existing.nhif;
      ahl = ahlOverride ?? existing.ahl;
      nita = toDecimal(Number(existing.nita ?? 0));
      const payeNum = Number(paye);
      const nssfNum = Number(nssf);
      const nhifNum = Number(nhif);
      const ahlNum = Number(ahl);
      if (leavePayMode === 'paye_only') {
        netPay = toDecimal(
          employmentGross - payeNum - nssfNum - nhifNum - ahlNum - otherDeductionsTotal + leavePayNum
        );
      } else {
        const g = employmentGross + (leavePayMode === 'included_in_gross' ? leavePayNum : 0);
        netPay = toDecimal(g - payeNum - nssfNum - nhifNum - ahlNum - otherDeductionsTotal);
      }
    }

    const finalGrossPay = recalculateStatutory
      ? calculateStatutoryForPayroll(
          leavePayMode,
          biweeklyMode && p1 != null && p2 != null ? p1 + p2 + allowancesTotal : Number(existing.basicPay) + allowancesTotal,
          leavePayNum,
          0
        ).grossPay
      : storedGrossPay;

    const resolvedAccountsId =
      (
        await mapOutsourcingClientsToAccountsClients([existing.employee.outsourcingClientId])
      ).get(existing.employee.outsourcingClientId) ?? null;

    if (statusOverride === 'approved' || statusOverride === 'paid') {
      const reauthError = requireRecentSensitiveAuth(request, user.id);
      if (reauthError) return reauthError;
      await enforceSodCheck({
        actorUserId: user.id,
        entityType: 'Payroll',
        entityId: id,
        forbiddenActions: ['payroll.updated', 'payroll.generated'],
        actionLabel: `payroll status transition to ${statusOverride}`,
      });
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        accountsClientId: resolvedAccountsId,
        ...(basicPay != null && !biweeklyMode ? { basicPay } : {}),
        ...(biweeklyMode && p1 != null && p2 != null
          ? {
              basicPay: toDecimal(p1 + p2),
              period1Gross: toDecimal(p1),
              period2Gross: toDecimal(p2),
            }
          : period1Gross != null || period2Gross != null
            ? {
                ...(period1Gross != null ? { period1Gross } : {}),
                ...(period2Gross != null ? { period2Gross } : {}),
              }
            : {}),
        ...(allowances != null ? { allowances } : {}),
        ...(deductions != null ? { deductions } : {}),
        ...(leavePayBody != null ? { leavePay: leavePayBody } : {}),
        ...(body.biweeklyAttendance !== undefined || proRateBiweekly
          ? { biweeklyAttendance: attendanceNorm as object }
          : {}),
        ...(statusOverride ? { status: statusOverride } : {}),
        grossPay: toDecimal(finalGrossPay),
        paye,
        nssf,
        nhif,
        ahl,
        nita,
        netPay,
      },
    });
    const statusChanged = body.status !== undefined && body.status !== existing.status;
    const auditAction = statusChanged ? `payroll.${String(body.status)}` : 'payroll.updated';
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: auditAction,
      entityType: 'Payroll',
      entityId: updated.id,
      route: 'PATCH /api/outsourcing/payroll/[id]',
      metadata: {
        month: updated.month,
        year: updated.year,
        statusBefore: existing.status,
        statusAfter: body.status ?? existing.status,
        recalculateStatutory,
      },
    });
    try {
      if (statusChanged && (statusOverride === 'approved' || statusOverride === 'paid')) {
        const workflowRun = await prisma.workflowRun.findFirst({
          where: { entityType: 'PayrollBatch', entityId: `${updated.year}-${updated.month}-${existing.employee.outsourcingClientId}` },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (workflowRun) {
          await transitionWorkflowRun(workflowRun.id, statusOverride === 'approved' ? 'approved' : 'completed', {
            actorUserId: user.id,
          });
        }
        const payrollUserIds = await getPayrollUserIds();
        await sendNotification({
          event: statusOverride === 'approved' ? 'payroll_approved' : 'payroll_locked',
          recipientUserIds: payrollUserIds,
          title: statusOverride === 'approved' ? 'Payroll approved' : 'Payroll locked',
          body:
            statusOverride === 'approved'
              ? `${updated.month}/${updated.year} payroll has been approved by ${user.name}.`
              : `${updated.month}/${updated.year} payroll is now locked. Payslips can be distributed.`,
          href: '/dashboard/outsourcing/payroll',
          priority: 'info',
          channel: 'in_app',
          workflowRunId: workflowRun?.id,
          metadata: { month: updated.month, year: updated.year, approver: user.name, workflowRunId: workflowRun?.id },
        });
      }
    } catch (err) {
      console.error('[notifications] Failed to send payroll status notification:', err);
    }

    return NextResponse.json({
      id: updated.id,
      basicPay: String(updated.basicPay),
      period1Gross: updated.period1Gross != null ? String(updated.period1Gross) : null,
      period2Gross: updated.period2Gross != null ? String(updated.period2Gross) : null,
      biweeklyAttendance: normalizeAttendance(updated.biweeklyAttendance, updated.year, updated.month),
      allowances: updated.allowances,
      deductions: updated.deductions,
      grossPay: String(updated.grossPay),
      leavePay: String(updated.leavePay ?? 0),
      paye: String(updated.paye),
      nssf: String(updated.nssf),
      nhif: String(updated.nhif),
      ahl: String(updated.ahl),
      nita: String(updated.nita ?? 0),
      netPay: String(updated.netPay),
    });
  } catch (e) {
    if (e instanceof SodViolationError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('[payroll PATCH]', e);
    return NextResponse.json({ error: 'Failed to update payroll' }, { status: 500 });
  }
}
