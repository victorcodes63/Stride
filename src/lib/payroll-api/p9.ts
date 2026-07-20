import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import { buildP9Card, summarizeP9, type P9PayrollInput } from '@/lib/p9';
import { generateP9Pdf } from '@/lib/p9-pdf';
import { payrollApiBase, resolvePayrollClientId, type PayrollHandlerOptions } from './scope';

export function createPayrollP9Handler({ scope }: PayrollHandlerOptions) {
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
      const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
      if (Number.isNaN(year) || year < 2000 || year > 3000) {
        return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
      }

      const employeeId = searchParams.get('employeeId') || undefined;
      const format = (searchParams.get('format') || 'json').toLowerCase();
      const requestedClientId = searchParams.get('clientId') || undefined;
      const clientId = await resolvePayrollClientId(
        scope,
        prisma,
        requestedClientId,
        request,
        ctx.organizationId,
      );

      if (employeeId && format === 'pdf') {
        const employee = await ctx.run((tx) =>
          tx.employee.findFirst({
            where: { ...ctx.where(), id: employeeId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              kraPin: true,
              client: { select: { name: true, kraPin: true } },
            },
          }),
        );
        if (!employee) {
          return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const payrolls = await ctx.run((tx) =>
          tx.payroll.findMany({
            where: { ...ctx.where(), employeeId, year },
            orderBy: { month: 'asc' },
          }),
        );

        const monthly: P9PayrollInput[] = payrolls.map((p) => ({
          month: p.month,
          basicPay: String(p.basicPay),
          allowances: p.allowances as P9PayrollInput['allowances'],
          grossPay: String(p.grossPay),
          leavePay: String(p.leavePay ?? 0),
          paye: String(p.paye),
          nssf: String(p.nssf),
          nhif: String(p.nhif),
          ahl: String(p.ahl ?? 0),
        }));

        const employeeName = `${employee.firstName} ${employee.lastName}`;
        const card = buildP9Card(monthly, {
          employerName: employee.client.name,
          employerPin: employee.client.kraPin ?? null,
          employeeId: employee.id,
          employeeName,
          employeeNumber: employee.employeeNumber ?? null,
          employeePin: employee.kraPin ?? null,
          year,
        });

        const pdf = await generateP9Pdf(card, year);

        await ctx.audit({
          action: 'payroll.p9.generate',
          entityType: 'Payroll',
          entityId: `${employee.id}-${year}`,
          route: `GET ${payrollApiBase(scope)}/p9`,
          metadata: { employeeId: employee.id, year, format: 'pdf', months: monthly.length },
        });

        const safeName = (employee.employeeNumber || employeeName || 'employee')
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const filename = `P9A_${safeName || 'employee'}_${year}.pdf`;

        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(pdf.length),
            'Cache-Control': 'no-store',
          },
        });
      }

      const payrolls = await ctx.run((tx) =>
        tx.payroll.findMany({
          where: {
            ...ctx.where(),
            year,
            ...(employeeId
              ? { employeeId }
              : { employee: { outsourcingClientId: clientId } }),
          },
          select: {
            employeeId: true,
            grossPay: true,
            paye: true,
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeNumber: true },
            },
          },
          orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
        }),
      );

      const byEmployee = new Map<
        string,
        { name: string; employeeNumber: string | null; rows: P9PayrollInput[] }
      >();
      for (const p of payrolls) {
        const entry = byEmployee.get(p.employeeId) ?? {
          name: `${p.employee.firstName} ${p.employee.lastName}`,
          employeeNumber: p.employee.employeeNumber ?? null,
          rows: [],
        };
        entry.rows.push({
          month: 0,
          basicPay: 0,
          grossPay: String(p.grossPay),
          paye: String(p.paye),
          nssf: 0,
          nhif: 0,
          ahl: 0,
        });
        byEmployee.set(p.employeeId, entry);
      }

      const employees = Array.from(byEmployee.entries())
        .map(([id, e]) =>
          summarizeP9(e.rows, {
            employeeId: id,
            employeeName: e.name,
            employeeNumber: e.employeeNumber,
          }),
        )
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

      await ctx.audit({
        action: 'payroll.p9.generate',
        entityType: 'PayrollBatch',
        entityId: `${year}-${clientId ?? 'all'}`,
        route: `GET ${payrollApiBase(scope)}/p9`,
        metadata: { year, format: 'json', clientId, count: employees.length },
      });

      return NextResponse.json({ year, clientId, employees });
    });
  };
}
