import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { calculateStatutoryForPayroll, getPayrollStatutoryRates } from '@/lib/payroll-calc';
import { isBiweeklyClient } from '@/lib/biweekly-payroll';
import { mapOutsourcingClientsToAccountsClients } from '@/lib/payroll-accounts-link';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

function toDecimal(n: number): Decimal {
  return new Decimal(Math.round(n * 100) / 100);
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const month = body.month != null ? parseInt(String(body.month), 10) : undefined;
    const year = body.year != null ? parseInt(String(body.year), 10) : undefined;
    const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      requestedClientId,
      request,
      ctx.organizationId,
    );
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

    const payrolls = await ctx.run((tx) =>
      tx.payroll.findMany({
        where: {
          ...ctx.where(),
          month,
          year,
          employee: {
            outsourcingClientId: clientId,
            ...(departmentId ? { departmentId } : {}),
            client: { organizationId: ctx.organizationId },
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
      }),
    );

    const accountsByOutsourcing = await mapOutsourcingClientsToAccountsClients(
      payrolls.map((p) => p.employee.outsourcingClientId),
    );

    const statutoryRates = await getPayrollStatutoryRates({
      clientId,
      organizationId: ctx.organizationId,
    });

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

      const calc = calculateStatutoryForPayroll(mode, employmentGross, leavePay, otherTotal, statutoryRates);

      await ctx.run((tx) =>
        tx.payroll.update({
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
        }),
      );
      updated++;
    }

    return NextResponse.json({
      updated,
      message: `Recalculated statutory for ${updated} record(s) (respects leave pay mode per client).`,
    });
  });
}
