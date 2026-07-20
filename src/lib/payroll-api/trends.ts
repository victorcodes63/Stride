import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import { payrollApiBase, resolvePayrollClientId, type PayrollHandlerOptions } from './scope';

/** Prisma Decimals arrive as objects; normalise to a finite number. */
function num(x: unknown): number {
  const n = Number(String(x ?? 0));
  return Number.isFinite(n) ? n : 0;
}

interface MonthBucket {
  month: number;
  headcount: number;
  gross: number;
  net: number;
  paye: number;
  nssf: number;
  nhif: number;
  ahl: number;
  nita: number;
  deductions: number;
}

export function createPayrollTrendsHandler({ scope }: PayrollHandlerOptions) {
  return async function GET(request: NextRequest) {
    return withTenant(request, async (ctx) => {
      if (!canAccessPayroll(ctx.staff)) {
        return forbiddenResponse('Payroll access is restricted to finance and admins.');
      }
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
      }

      const { searchParams } = new URL(request.url);
      const yearParam = searchParams.get('year');
      const requestedClientId = searchParams.get('clientId') || undefined;
      const clientId = await resolvePayrollClientId(
        scope,
        prisma,
        requestedClientId,
        request,
        ctx.organizationId,
      );
      const departmentId = searchParams.get('departmentId') || undefined;

      const y = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
      if (Number.isNaN(y)) {
        return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
      }

      const payrolls = await ctx.run((tx) =>
        tx.payroll.findMany({
          where: {
            ...ctx.where(),
            year: y,
            ...(clientId || departmentId
              ? {
                  employee: {
                    ...(clientId ? { outsourcingClientId: clientId } : {}),
                    ...(departmentId ? { departmentId } : {}),
                  },
                }
              : {}),
          },
          select: {
            month: true,
            employeeId: true,
            grossPay: true,
            netPay: true,
            paye: true,
            nssf: true,
            nhif: true,
            ahl: true,
            nita: true,
          },
        }),
      );

      const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        headcount: 0,
        gross: 0,
        net: 0,
        paye: 0,
        nssf: 0,
        nhif: 0,
        ahl: 0,
        nita: 0,
        deductions: 0,
      }));
      const monthEmployees: Array<Set<string>> = Array.from({ length: 12 }, () => new Set<string>());

      for (const p of payrolls) {
        if (p.month < 1 || p.month > 12) continue;
        const bucket = buckets[p.month - 1];
        const gross = num(p.grossPay);
        const net = num(p.netPay);
        bucket.gross += gross;
        bucket.net += net;
        bucket.paye += num(p.paye);
        bucket.nssf += num(p.nssf);
        bucket.nhif += num(p.nhif);
        bucket.ahl += num(p.ahl);
        bucket.nita += num(p.nita);
        bucket.deductions += gross - net;
        monthEmployees[p.month - 1].add(p.employeeId);
      }
      for (let i = 0; i < 12; i += 1) {
        buckets[i].headcount = monthEmployees[i].size;
      }

      const monthsWithData = buckets.filter((b) => b.headcount > 0);
      const ytd = {
        gross: 0,
        net: 0,
        paye: 0,
        nssf: 0,
        nhif: 0,
        ahl: 0,
        nita: 0,
        deductions: 0,
        avgHeadcount: 0,
      };
      for (const b of buckets) {
        ytd.gross += b.gross;
        ytd.net += b.net;
        ytd.paye += b.paye;
        ytd.nssf += b.nssf;
        ytd.nhif += b.nhif;
        ytd.ahl += b.ahl;
        ytd.nita += b.nita;
        ytd.deductions += b.deductions;
      }
      ytd.avgHeadcount = monthsWithData.length
        ? monthsWithData.reduce((sum, b) => sum + b.headcount, 0) / monthsWithData.length
        : 0;

      await ctx.audit({
        action: 'payroll.trends.view',
        entityType: 'PayrollBatch',
        entityId: `${y}-${clientId ?? 'all'}`,
        route: `GET ${payrollApiBase(scope)}/trends`,
        metadata: {
          year: y,
          clientId: clientId ?? null,
          departmentId: departmentId ?? null,
          rows: payrolls.length,
        },
      });

      return NextResponse.json({ year: y, months: buckets, ytd });
    });
  };
}
