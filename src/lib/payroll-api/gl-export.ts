import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { buildPayrollJournal, journalToCsv, DEFAULT_GL_ACCOUNTS } from '@/lib/payroll-gl';
import { withTenant } from '@/lib/tenant-api';
import { payrollApiBase, resolvePayrollClientId, type PayrollHandlerOptions } from './scope';

export function createPayrollGlExportHandler({ scope }: PayrollHandlerOptions) {
  return async function GET(request: NextRequest) {
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
      const clientId = await resolvePayrollClientId(
        scope,
        prisma,
        requestedClientId,
        request,
        ctx.organizationId,
      );
      const departmentId = searchParams.get('departmentId') || undefined;
      const format = (searchParams.get('format') || 'csv').toLowerCase() === 'json' ? 'json' : 'csv';

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
            employee: {
              include: {
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

      const journal = buildPayrollJournal(
        payrolls.map((p) => ({
          costCenter: p.employee.department?.name ?? null,
          grossPay: Number(String(p.grossPay)),
          netPay: Number(String(p.netPay)),
          paye: Number(String(p.paye)),
          nssf: Number(String(p.nssf)),
          nhif: Number(String(p.nhif)),
          ahl: Number(String(p.ahl ?? 0)),
          nita: Number(String(p.nita ?? 0)),
        })),
        {
          groupByCostCenter: true,
          date: new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10),
        },
      );

      await ctx.audit({
        action: 'payroll.gl.export',
        entityType: 'PayrollBatch',
        entityId: `${y}-${m}-${clientId ?? 'all'}`,
        route: `GET ${payrollApiBase(scope)}/gl-export`,
        metadata: {
          month: m,
          year: y,
          clientId: clientId ?? null,
          departmentId: departmentId ?? null,
          format,
          count: payrolls.length,
          balanced: journal.balanced,
          difference: journal.difference,
        },
      });

      if (format === 'json') {
        return NextResponse.json({
          period: { month: m, year: y },
          balanced: journal.balanced,
          difference: journal.difference,
          totalDebit: journal.totalDebit,
          totalCredit: journal.totalCredit,
          lines: journal.lines,
          grandTotal: journal.grandTotal,
          accounts: DEFAULT_GL_ACCOUNTS,
        });
      }

      const csv = journalToCsv(journal);
      const filename = `payroll-journal-${y}-${String(m).padStart(2, '0')}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    });
  };
}
