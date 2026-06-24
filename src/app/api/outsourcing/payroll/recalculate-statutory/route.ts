import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import { isBiweeklyClient } from '@/lib/biweekly-payroll';
import { mapOutsourcingClientsToAccountsClients } from '@/lib/payroll-accounts-link';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';

function toDecimal(n: number): Decimal {
  return new Decimal(Math.round(n * 100) / 100);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const month = body.month != null ? parseInt(String(body.month), 10) : undefined;
    const year = body.year != null ? parseInt(String(body.year), 10) : undefined;
    const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const departmentId = typeof body.departmentId === 'string' ? body.departmentId : undefined;

    if (
      month === undefined ||
      year === undefined ||
      Number.isNaN(month) ||
      month < 1 ||
      month > 12 ||
      Number.isNaN(year)
    ) {
      return NextResponse.json({ error: 'Valid month and year required' }, { status: 400 });
    }

    const payrolls = await prisma.payroll.findMany({
      where: {
        month,
        year,
        employee: {
          outsourcingClientId: clientId,
          ...(departmentId ? { departmentId } : {}),
        },
      },
      include: {
        employee: {
          select: {
            outsourcingClientId: true,
            client: { select: { leavePayMode: true, payrollFrequency: true } },
          },
        },
      },
    });

    const accountsByOutsourcing = await mapOutsourcingClientsToAccountsClients(
      payrolls.map((p) => p.employee.outsourcingClientId),
    );

    let updated = 0;
    for (const p of payrolls) {
      const allowances = (p.allowances as { name: string; amount: number }[]) ?? [];
      const allowancesTotal = allowances.reduce((s, a) => s + (a?.amount ?? 0), 0);
      const otherDeductions = (p.deductions as { name: string; amount: number }[]) ?? [];
      const otherTotal = otherDeductions.reduce((s, d) => s + (d?.amount ?? 0), 0);
      const leavePay = Number(p.leavePay ?? 0);
      const mode = p.employee.client.leavePayMode ?? 'none';
      const p1 = p.period1Gross != null ? Number(p.period1Gross) : null;
      const p2 = p.period2Gross != null ? Number(p.period2Gross) : null;
      const biweekly =
        isBiweeklyClient(p.employee.client.payrollFrequency) && p1 != null && p2 != null;
      const employmentGross = biweekly ? p1! + p2! + allowancesTotal : Number(p.basicPay) + allowancesTotal;

      const calc = calculateStatutoryForPayroll(mode, employmentGross, leavePay, otherTotal);

      await prisma.payroll.update({
        where: { id: p.id },
        data: {
          accountsClientId: accountsByOutsourcing.get(p.employee.outsourcingClientId) ?? null,
          grossPay: toDecimal(calc.grossPay),
          paye: toDecimal(calc.paye),
          nssf: toDecimal(calc.nssf),
          nhif: toDecimal(calc.nhif),
          ahl: toDecimal(calc.ahl),
          nita: toDecimal(calc.nita),
          netPay: toDecimal(calc.netPay),
        },
      });
      updated++;
    }

    return NextResponse.json({
      updated,
      message: `Recalculated statutory for ${updated} record(s) (respects leave pay mode per client).`,
    });
  } catch (e) {
    console.error('[payroll recalculate-statutory]', e);
    return NextResponse.json({ error: 'Failed to recalculate' }, { status: 500 });
  }
}
