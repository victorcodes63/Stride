import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import {
  estimateCommissionsForPeriod,
  parseCommissionRuleConfig,
} from '@/lib/sales/commission';
import { parsePeriodBounds } from '@/lib/sales/schema';
import { canManageSalesTargets } from '@/lib/staff-permissions';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const COMMISSION_ALLOWANCE_NAME = 'Sales commission';

function toDecimal(n: number) {
  return new Decimal(n);
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const periodType = request.nextUrl.searchParams.get('periodType')?.trim() || 'month';
    const anchor = new Date();
    const { periodStart, periodEnd } = parsePeriodBounds(
      periodType === 'quarter' || periodType === 'year' ? periodType : 'month',
      anchor,
    );

    try {
      const { estimates, rules } = await ctx.run(async (tx) => {
        const ruleRows = await tx.salesCommissionRule.findMany({
          where: { organizationId: ctx.organizationId },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        });
        const rules = ruleRows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
          config: parseCommissionRuleConfig(r.config),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));

        const rows = await estimateCommissionsForPeriod(tx, {
          organizationId: ctx.organizationId,
          periodStart,
          periodEnd,
        });
        const ids = rows.map((r) => r.employeeId);
        const employees = await tx.employee.findMany({
          where: { id: { in: ids }, organizationId: ctx.organizationId },
          select: { id: true, firstName: true, lastName: true },
        });
        const nameById = new Map(
          employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()] as const),
        );

        const month = periodStart.getUTCMonth() + 1;
        const year = periodStart.getUTCFullYear();
        const payrolls = await tx.payroll.findMany({
          where: {
            organizationId: ctx.organizationId,
            employeeId: { in: ids },
            month,
            year,
          },
          select: { employeeId: true, id: true, status: true, allowances: true },
        });
        const payrollByEmp = new Map(payrolls.map((p) => [p.employeeId, p] as const));

        const estimates = rows.map((r) => {
          const pay = payrollByEmp.get(r.employeeId);
          const allowances = (pay?.allowances as { name: string; amount: number }[]) ?? [];
          const alreadyPushed = allowances.some(
            (a) => a.name === COMMISSION_ALLOWANCE_NAME && a.amount === r.commissionAmount,
          );
          return {
            ...r,
            employeeName: nameById.get(r.employeeId) ?? r.employeeId.slice(0, 8),
            payrollStatus: pay?.status ?? null,
            payrollId: pay?.id ?? null,
            alreadyPushed,
          };
        });

        return { estimates, rules };
      });

      return NextResponse.json({
        estimates,
        rules,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        canPushToPayroll: canManageSalesTargets(ctx.staff.role, ctx.staff.staffUserType),
        canManageRules: canManageSalesTargets(ctx.staff.role, ctx.staff.staffUserType),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/commissions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to estimate commissions.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (body.action === 'push_to_payroll') {
      if (!canManageSalesTargets(ctx.staff.role, ctx.staff.staffUserType)) {
        return NextResponse.json(
          { error: 'Only sales managers and finance can push commissions to payroll.' },
          { status: 403 },
        );
      }

      const periodType = typeof body.periodType === 'string' ? body.periodType.trim() : 'month';
      const anchor = new Date();
      const { periodStart, periodEnd } = parsePeriodBounds(
        periodType === 'quarter' || periodType === 'year' ? periodType : 'month',
        anchor,
      );
      const month = periodStart.getUTCMonth() + 1;
      const year = periodStart.getUTCFullYear();
      const selectedIds = Array.isArray(body.employeeIds)
        ? (body.employeeIds as unknown[])
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim())
        : null;

      try {
        const result = await ctx.run(async (tx) => {
          let estimates = await estimateCommissionsForPeriod(tx, {
            organizationId: ctx.organizationId,
            periodStart,
            periodEnd,
          });
          if (selectedIds && selectedIds.length > 0) {
            const allow = new Set(selectedIds);
            estimates = estimates.filter((e) => allow.has(e.employeeId));
          }

          const pushed: Array<{
            employeeId: string;
            payrollId: string;
            amount: number;
            grossPay: number;
            netPay: number;
          }> = [];
          const skipped: Array<{ employeeId: string; reason: string }> = [];

          for (const est of estimates) {
            if (est.commissionAmount <= 0) {
              skipped.push({ employeeId: est.employeeId, reason: 'Zero commission' });
              continue;
            }

            const payroll = await tx.payroll.findFirst({
              where: {
                employeeId: est.employeeId,
                month,
                year,
                organizationId: ctx.organizationId,
              },
              include: {
                employee: {
                  include: {
                    client: { select: { leavePayMode: true } },
                  },
                },
              },
            });

            if (!payroll) {
              skipped.push({
                employeeId: est.employeeId,
                reason: `No payroll draft for ${year}-${String(month).padStart(2, '0')}`,
              });
              continue;
            }
            if (payroll.status !== 'draft') {
              skipped.push({
                employeeId: est.employeeId,
                reason: `Payroll is ${payroll.status}`,
              });
              continue;
            }

            const existing = (payroll.allowances as { name: string; amount: number }[]) ?? [];
            const withoutCommission = existing.filter((a) => a.name !== COMMISSION_ALLOWANCE_NAME);
            const allowances = [
              ...withoutCommission,
              { name: COMMISSION_ALLOWANCE_NAME, amount: est.commissionAmount },
            ];
            const allowancesTotal = allowances.reduce((s, a) => s + (a?.amount ?? 0), 0);
            const basic = Number(payroll.basicPay);
            const employmentGross = basic + allowancesTotal;
            const otherDeductions = (
              (payroll.deductions as { name: string; amount: number }[]) ?? []
            ).reduce((s, d) => s + (d?.amount ?? 0), 0);
            const leavePay = Number(payroll.leavePay ?? 0);
            const leavePayMode = payroll.employee.client?.leavePayMode ?? 'none';
            const calc = calculateStatutoryForPayroll(
              leavePayMode,
              employmentGross,
              leavePay,
              otherDeductions,
            );

            await tx.payroll.update({
              where: { id: payroll.id },
              data: {
                allowances,
                grossPay: toDecimal(calc.grossPay),
                paye: toDecimal(calc.paye),
                nssf: toDecimal(calc.nssf),
                nhif: toDecimal(calc.nhif),
                ahl: toDecimal(calc.ahl),
                nita: toDecimal(calc.nita),
                netPay: toDecimal(Math.max(0, calc.netPay)),
              },
            });

            pushed.push({
              employeeId: est.employeeId,
              payrollId: payroll.id,
              amount: est.commissionAmount,
              grossPay: calc.grossPay,
              netPay: calc.netPay,
            });
          }

          return { pushed, skipped, month, year };
        });

        return NextResponse.json({ result });
      } catch (error) {
        await reportApiError({
          route: 'POST /api/sales/commissions (push_to_payroll)',
          message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: 'Failed to push commissions.' }, { status: 500 });
      }
    }

    if (!canManageSalesTargets(ctx.staff.role, ctx.staff.staffUserType)) {
      return NextResponse.json(
        { error: 'Only sales managers and finance can create commission rules.' },
        { status: 403 },
      );
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const parsedConfig = parseCommissionRuleConfig(body.config);
    if (!name || !parsedConfig) {
      return NextResponse.json(
        {
          error:
            'name and a valid config are required (tiers with minAttainmentPct and ratePct).',
        },
        { status: 400 },
      );
    }

    try {
      const rule = await ctx.run(async (tx) => {
        if (body.activate === true) {
          await tx.salesCommissionRule.updateMany({
            where: { organizationId: ctx.organizationId, status: 'active' },
            data: { status: 'archived' },
          });
        }
        return tx.salesCommissionRule.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            description: typeof body.description === 'string' ? body.description.trim() || null : null,
            status: body.activate === true ? 'active' : 'draft',
            config: parsedConfig,
          },
        });
      });

      return NextResponse.json(
        { rule: { id: rule.id, status: rule.status, config: parsedConfig } },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/commissions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to save commission rule.' }, { status: 500 });
    }
  });
}
