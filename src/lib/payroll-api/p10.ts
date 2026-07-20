import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import { buildP10Return, p10SectionBToCsv, type P10PayrollInput } from '@/lib/p10';
import { payrollApiBase, resolvePayrollClientId, type PayrollHandlerOptions } from './scope';

/**
 * KRA P10 (Simplified Unified Payroll Return) export for one month.
 *
 *   GET .../p10?month=&year=&clientId=&departmentId=&format=csv|json&header=0
 *
 * `csv`  → Section B rows in the template's column order (importable / paste-able).
 * `json` → full return preview (Section A basic info + Section B rows + Section E totals).
 */
export function createPayrollP10Handler({ scope }: PayrollHandlerOptions) {
  return async function GET(request: NextRequest) {
    return withTenant(request, async (ctx) => {
      if (!canAccessPayroll(ctx.staff)) {
        return forbiddenResponse('Payroll access is restricted to finance and admins.');
      }
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
      }

      const { searchParams } = new URL(request.url);
      const monthParam = searchParams.get('month');
      const yearParam = searchParams.get('year');
      const requestedClientId = searchParams.get('clientId') || undefined;
      const departmentId = searchParams.get('departmentId') || undefined;
      const format = (searchParams.get('format') || 'csv').toLowerCase() === 'json' ? 'json' : 'csv';
      const includeHeader = searchParams.get('header') !== '0';

      const m = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;
      const y = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
      if (Number.isNaN(m) || m < 1 || m > 12 || Number.isNaN(y) || y < 2000 || y > 3000) {
        return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
      }

      const clientId = await resolvePayrollClientId(
        scope,
        prisma,
        requestedClientId,
        request,
        ctx.organizationId,
      );

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
          select: {
            employeeId: true,
            basicPay: true,
            grossPay: true,
            paye: true,
            nssf: true,
            nhif: true,
            ahl: true,
            nita: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                kraPin: true,
                client: { select: { name: true, kraPin: true } },
              },
            },
          },
          orderBy: [
            { employee: { lastName: 'asc' } },
            { employee: { firstName: 'asc' } },
          ],
        }),
      );

      const inputs: P10PayrollInput[] = payrolls.map((p) => ({
        employeeId: p.employeeId,
        employeeName: `${p.employee.firstName} ${p.employee.lastName}`.trim(),
        employeePin: p.employee.kraPin ?? null,
        basicPay: String(p.basicPay),
        grossPay: String(p.grossPay),
        paye: String(p.paye),
        nssf: String(p.nssf),
        nhif: String(p.nhif),
        ahl: String(p.ahl ?? 0),
        nita: String(p.nita ?? 0),
      }));

      const employerName = payrolls[0]?.employee.client.name ?? 'Employer';
      const employerPin = payrolls[0]?.employee.client.kraPin ?? null;

      const ret = buildP10Return(inputs, {
        employerName,
        employerPin,
        month: m,
        year: y,
      });

      await ctx.audit({
        action: 'payroll.p10.export',
        entityType: 'PayrollBatch',
        entityId: `${y}-${m}-${clientId ?? 'all'}`,
        route: `GET ${payrollApiBase(scope)}/p10`,
        metadata: {
          month: m,
          year: y,
          clientId: clientId ?? null,
          departmentId: departmentId ?? null,
          format,
          employees: ret.rows.length,
          totalPayable: ret.taxDue.totalPayable,
          missingPin: ret.rows.filter((r) => r.hasNoPin).length,
        },
      });

      if (format === 'json') {
        return NextResponse.json({
          period: { month: m, year: y },
          basicInfo: ret.basicInfo,
          rows: ret.rows,
          taxDue: ret.taxDue,
        });
      }

      const csv = p10SectionBToCsv(ret, includeHeader);
      const filename = `P10_SectionB_${y}-${String(m).padStart(2, '0')}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    });
  };
}
