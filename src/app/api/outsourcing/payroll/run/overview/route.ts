import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import {
  buildEmployeeReadinessRows,
  computePayrollVariance,
  priorPayrollPeriod,
  sumPayrollTotals,
} from '@/lib/payroll/run-wizard';

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : NaN;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : NaN;
    const requestedClientId = searchParams.get('clientId') || undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const departmentId = searchParams.get('departmentId') || undefined;

    if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
      return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 });
    }

    const employeeWhere = {
      outsourcingClientId: clientId,
      ...(departmentId ? { departmentId } : {}),
      employmentStatus: 'active' as const,
    };

    const [employees, payrolls, priorPeriod] = await Promise.all([
      prisma.employee.findMany({
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
      prisma.payroll.findMany({
        where: {
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
      priorPayrollPeriod(month, year),
    ]);

    const priorPayrolls = await prisma.payroll.findMany({
      where: {
        month: priorPeriod.month,
        year: priorPeriod.year,
        employee: employeeWhere,
      },
      select: {
        employeeId: true,
        grossPay: true,
        netPay: true,
      },
    });

    const readiness = buildEmployeeReadinessRows(employees);
    const draftCount = payrolls.filter((p) => p.status === 'draft').length;
    const approvedCount = payrolls.filter((p) => p.status === 'approved').length;
    const paidCount = payrolls.filter((p) => p.status === 'paid').length;
    const totals = sumPayrollTotals(
      payrolls.map((p) => ({
        grossPay: p.grossPay,
        netPay: p.netPay,
        paye: p.paye,
        nssf: p.nssf,
        nhif: p.nhif,
        ahl: p.ahl,
      })),
    );

    const variance = computePayrollVariance(
      payrolls.map((p) => ({
        employeeId: p.employeeId,
        employeeName: `${p.employee.firstName} ${p.employee.lastName}`.trim(),
        grossPay: p.grossPay,
        netPay: p.netPay,
      })),
      priorPayrolls.map((p) => ({
        employeeId: p.employeeId,
        grossPay: p.grossPay,
        netPay: p.netPay,
      })),
      priorPeriod,
    );

    const batchEntityId = `${year}-${month}-${clientId}`;
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        organizationId: user.currentOrgId,
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
    });

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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('outside active entity scope')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error('[payroll/run/overview]', e);
    return NextResponse.json({ error: 'Failed to load payroll run overview' }, { status: 500 });
  }
}
