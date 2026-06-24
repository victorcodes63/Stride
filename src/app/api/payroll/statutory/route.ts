import { Decimal } from '@prisma/client/runtime/library';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import {
  buildObligationLines,
  buildStatutoryTotals,
  defaultDueDate,
  deriveReturnStatus,
  to2,
} from '@/lib/statutory-returns';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { enforceSodCheck, requireRecentSensitiveAuth, SodViolationError } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';

function toDecimal(v: number) {
  return new Decimal(to2(v));
}

function parseMonthYear(searchParams: URLSearchParams) {
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year) || year < 2020 || year > 2100) {
    return null;
  }
  return { month, year };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) return forbiddenResponse('Payroll/statutory access is restricted.');
    const { searchParams } = new URL(request.url);
    const monthYear = parseMonthYear(searchParams);
    if (!monthYear) {
      return NextResponse.json({ error: 'Invalid month/year' }, { status: 400 });
    }

    const requestedClientId = searchParams.get('clientId');
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const client = await prisma.outsourcingClient.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, kraPin: true, nssfEmployerNumber: true, nhifEmployerNumber: true, currency: true },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const [employees, payrolls, existingReturn] = await Promise.all([
      prisma.employee.findMany({
        where: { outsourcingClientId: clientId },
        select: { id: true, idNumber: true, kraPin: true, nssfNumber: true, nhifNumber: true },
      }),
      prisma.payroll.findMany({
        where: { month: monthYear.month, year: monthYear.year, employee: { outsourcingClientId: clientId } },
        select: { id: true, grossPay: true, paye: true, nssf: true, nhif: true, ahl: true, deductions: true },
      }),
      prisma.statutoryReturn.findUnique({
        where: { outsourcingClientId_month_year: { outsourcingClientId: clientId, month: monthYear.month, year: monthYear.year } },
        include: { items: { orderBy: { obligationType: 'asc' } } },
      }),
    ]);

    const totals = buildStatutoryTotals(payrolls, employees.length);
    const coveragePct = employees.length > 0 ? to2((payrolls.length / employees.length) * 100) : 0;
    const dueDate = defaultDueDate(monthYear.year, monthYear.month);
    const missing = {
      idNumber: employees.filter((e) => !e.idNumber).length,
      kraPin: employees.filter((e) => !e.kraPin).length,
      nssfNumber: employees.filter((e) => !e.nssfNumber).length,
      nhifNumber: employees.filter((e) => !e.nhifNumber).length,
    };

    const obligations =
      existingReturn?.items.map((item) => ({
        id: item.id,
        obligationType: item.obligationType,
        authority: item.authority,
        employeeAmount: Number(item.employeeAmount),
        employerAmount: Number(item.employerAmount),
        liabilityAmount: Number(item.liabilityAmount),
        dueDate: item.dueDate.toISOString(),
        status: item.status,
        referenceNumber: item.referenceNumber,
        paymentReference: item.paymentReference,
        notes: item.notes,
        submittedAt: item.submittedAt?.toISOString() ?? null,
        paidAt: item.paidAt?.toISOString() ?? null,
      })) ?? buildObligationLines(totals, monthYear.month, monthYear.year).map((line) => ({
        id: null,
        obligationType: line.obligationType,
        authority: line.authority,
        employeeAmount: line.employeeAmount,
        employerAmount: line.employerAmount,
        liabilityAmount: line.liabilityAmount,
        dueDate: line.dueDate.toISOString(),
        status: line.status,
        referenceNumber: null,
        paymentReference: null,
        notes: null,
        submittedAt: null,
        paidAt: null,
      }));

    const returnStatus = existingReturn
      ? existingReturn.status
      : deriveReturnStatus(obligations.map((o) => o.status), dueDate);

    return NextResponse.json({
      period: monthYear,
      client: {
        id: client.id,
        name: client.name,
        currency: client.currency || 'KES',
        registrations: {
          kraPin: client.kraPin || null,
          nssfEmployerNumber: client.nssfEmployerNumber || null,
          shifEmployerNumber: client.nhifEmployerNumber || null,
        },
      },
      totals,
      compliance: {
        dueDate: dueDate.toISOString(),
        returnId: existingReturn?.id ?? null,
        status: returnStatus,
        coveragePct,
        employeeDataGaps: missing,
      },
      obligations,
      notes: existingReturn?.notes ?? null,
      timestamps: {
        submittedAt: existingReturn?.submittedAt?.toISOString() ?? null,
        paidAt: existingReturn?.paidAt?.toISOString() ?? null,
        updatedAt: existingReturn?.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('[payroll statutory GET]', error);
    return NextResponse.json({ error: 'Failed to load statutory return' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) return forbiddenResponse('Payroll/statutory access is restricted.');
    const reauthError = requireRecentSensitiveAuth(request, user.id);
    if (reauthError) return reauthError;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const month = parseInt(String(body.month ?? ''), 10);
    const year = parseInt(String(body.year ?? ''), 10);
    if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
      return NextResponse.json({ error: 'Valid month/year required' }, { status: 400 });
    }

    const clientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      typeof body.clientId === 'string' ? body.clientId : undefined,
      request,
    );
    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;

    const [employees, payrolls] = await Promise.all([
      prisma.employee.findMany({ where: { outsourcingClientId: clientId }, select: { id: true } }),
      prisma.payroll.findMany({
        where: { month, year, employee: { outsourcingClientId: clientId } },
        select: { id: true, grossPay: true, paye: true, nssf: true, nhif: true, ahl: true, deductions: true },
      }),
    ]);
    const totals = buildStatutoryTotals(payrolls, employees.length);
    const obligationLines = buildObligationLines(totals, month, year);

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.statutoryReturn.findUnique({
        where: { outsourcingClientId_month_year: { outsourcingClientId: clientId, month, year } },
        include: { items: true },
      });
      const dueDate = defaultDueDate(year, month);
      const mergedStatuses = existing?.items.map((i) => i.status) ?? obligationLines.map((i) => i.status);
      const status = deriveReturnStatus(mergedStatuses, dueDate);

      const upserted = await tx.statutoryReturn.upsert({
        where: { outsourcingClientId_month_year: { outsourcingClientId: clientId, month, year } },
        create: {
          outsourcingClientId: clientId,
          month,
          year,
          employeeCount: totals.employeeCount,
          payrollCount: totals.payrollCount,
          totalGrossPay: toDecimal(totals.totalGrossPay),
          totalPaye: toDecimal(totals.totalPaye),
          totalNssfEmployee: toDecimal(totals.totalNssfEmployee),
          totalNssfEmployer: toDecimal(totals.totalNssfEmployer),
          totalShif: toDecimal(totals.totalShif),
          totalAhlEmployee: toDecimal(totals.totalAhlEmployee),
          totalAhlEmployer: toDecimal(totals.totalAhlEmployer),
          totalOtherDeductions: toDecimal(totals.totalOtherDeductions),
          status,
          notes: notes || null,
        },
        update: {
          employeeCount: totals.employeeCount,
          payrollCount: totals.payrollCount,
          totalGrossPay: toDecimal(totals.totalGrossPay),
          totalPaye: toDecimal(totals.totalPaye),
          totalNssfEmployee: toDecimal(totals.totalNssfEmployee),
          totalNssfEmployer: toDecimal(totals.totalNssfEmployer),
          totalShif: toDecimal(totals.totalShif),
          totalAhlEmployee: toDecimal(totals.totalAhlEmployee),
          totalAhlEmployer: toDecimal(totals.totalAhlEmployer),
          totalOtherDeductions: toDecimal(totals.totalOtherDeductions),
          status,
          ...(notes !== undefined ? { notes: notes || null } : {}),
        },
      });

      for (const line of obligationLines) {
        const existingItem = existing?.items.find((i) => i.obligationType === line.obligationType);
        await tx.statutoryReturnItem.upsert({
          where: {
            statutoryReturnId_obligationType: {
              statutoryReturnId: upserted.id,
              obligationType: line.obligationType,
            },
          },
          create: {
            statutoryReturnId: upserted.id,
            obligationType: line.obligationType,
            authority: line.authority,
            employeeAmount: toDecimal(line.employeeAmount),
            employerAmount: toDecimal(line.employerAmount),
            liabilityAmount: toDecimal(line.liabilityAmount),
            dueDate: line.dueDate,
            status: line.status,
          },
          update: {
            authority: line.authority,
            employeeAmount: toDecimal(line.employeeAmount),
            employerAmount: toDecimal(line.employerAmount),
            liabilityAmount: toDecimal(line.liabilityAmount),
            dueDate: line.dueDate,
            status: existingItem?.status ?? line.status,
          },
        });
      }

      return tx.statutoryReturn.findUnique({
        where: { id: upserted.id },
        include: { items: { orderBy: { obligationType: 'asc' } } },
      });
    });
    if (saved?.id) {
      await enforceSodCheck({
        actorUserId: user.id,
        entityType: 'StatutoryReturn',
        entityId: saved.id,
        forbiddenActions: ['statutory.return.prepared'],
        actionLabel: 'statutory return submission',
      });
      await logAuditEvent({
        actor: { userId: user.id, email: user.email, name: user.name },
        action: 'statutory.return.prepared',
        entityType: 'StatutoryReturn',
        entityId: saved.id,
        route: 'POST /api/payroll/statutory',
        metadata: { month, year, clientId },
      });
    }

    return NextResponse.json({
      id: saved?.id,
      status: saved?.status ?? 'draft',
      message: 'Statutory return snapshot saved successfully.',
    });
  } catch (error) {
    if (error instanceof SodViolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[payroll statutory POST]', error);
    return NextResponse.json({ error: 'Failed to save statutory return' }, { status: 500 });
  }
}
