import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import {
  buildEmployeeReadinessRows,
  computePayrollVariance,
  priorPayrollPeriod,
  sumPayrollTotals,
} from '@/lib/payroll/run-wizard';
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
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : NaN;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : NaN;
    const requestedClientId = searchParams.get('clientId') || undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      requestedClientId,
      request,
      ctx.organizationId,
    );
    const departmentId = searchParams.get('departmentId') || undefined;

    if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
      return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 });
    }

    const employeeWhere = {
      outsourcingClientId: clientId,
      ...(departmentId ? { departmentId } : {}),
      employmentStatus: 'active' as const,
      client: { organizationId: ctx.organizationId },
    };

    const [employees, payrolls, priorPeriod] = await Promise.all([
      ctx.run((tx) =>
        tx.employee.findMany({
          where: employeeWhere,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            kraPin: true,
            nssfNumber: true,
            bankName: true,
            bankAccountNumber: true,
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        }),
      ),
      ctx.run((tx) =>
        tx.payroll.findMany({
          where: {
            ...ctx.where(),
            month,
            year,
            employee: employeeWhere,
          },
          select: {
            id: true,
            employeeId: true,
            status: true,
            grossPay: true,
            netPay: true,
            paye: true,
            nssf: true,
            nhif: true,
            ahl: true,
            employee: {
              select: { firstName: true, lastName: true },
            },
          },
        }),
      ),
      priorPayrollPeriod(month, year),
    ]);

    const priorPayrolls = await ctx.run((tx) =>
      tx.payroll.findMany({
        where: {
          ...ctx.where(),
          month: priorPeriod.month,
          year: priorPeriod.year,
          employee: employeeWhere,
        },
        select: {
          employeeId: true,
          grossPay: true,
          netPay: true,
        },
      }),
    );

    const readiness = buildEmployeeReadinessRows(employees);
    const draftCount = payrolls.filter((p) => p.status === 'draft').length;
    const approvedCount = payrolls.filter((p) => p.status === 'approved').length;
    const paidCount = payrolls.filter((p) => p.status === 'paid').length;
    const totals = sumPayrollTotals(
      payrolls.map((p) => ({
        grossPay: Number(p.grossPay),
        netPay: Number(p.netPay),
        paye: Number(p.paye),
        nssf: Number(p.nssf),
        nhif: Number(p.nhif),
        ahl: Number(p.ahl),
      })),
    );

    const variance = computePayrollVariance(
      payrolls.map((p) => ({
        employeeId: p.employeeId,
        employeeName: `${p.employee.firstName} ${p.employee.lastName}`.trim(),
        grossPay: Number(p.grossPay),
        netPay: Number(p.netPay),
      })),
      priorPayrolls.map((p) => ({
        employeeId: p.employeeId,
        grossPay: Number(p.grossPay),
        netPay: Number(p.netPay),
      })),
      priorPeriod,
    );

    const batchEntityId = `${year}-${month}-${clientId}`;
    const auditEvents = await ctx.run((tx) =>
      tx.auditEvent.findMany({
        where: {
          organizationId: ctx.organizationId,
          OR: [
            { entityId: batchEntityId, entityType: 'PayrollBatch' },
            { action: { in: ['payroll.run.approve', 'payroll.approved', 'payroll.generated'] } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          actorEmail: true,
          createdAt: true,
          entityId: true,
          metadata: true,
        },
      }),
    );

    const scopedAudit = auditEvents.filter((e) => {
      if (e.entityId === batchEntityId) return true;
      const meta = e.metadata as { month?: number; year?: number } | null;
      return meta?.month === month && meta?.year === year;
    });

    return NextResponse.json({
      month,
      year,
      clientId,
      departmentId: departmentId ?? null,
      scope: {
        employeeCount: employees.length,
        payrollCount: payrolls.length,
        draftCount,
        approvedCount,
        paidCount,
      },
      validation: {
        readyCount: readiness.readyCount,
        issueCount: readiness.rows.length,
        issues: readiness.rows,
      },
      totals,
      variance: {
        priorMonth: variance.priorMonth,
        priorYear: variance.priorYear,
        grossDelta: variance.grossDelta,
        netDelta: variance.netDelta,
        grossDeltaPct: variance.grossDeltaPct,
        topMovers: variance.rows.slice(0, 10),
      },
      auditTrail: scopedAudit.slice(0, 8).map((e) => ({
        id: e.id,
        action: e.action,
        actorEmail: e.actorEmail,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  });
}
