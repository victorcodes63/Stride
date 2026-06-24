import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import { downloadHeaders, parseFormat, parsePeriod, requireReportsUser } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

type StatutoryType = 'p9' | 'p10' | 'nssf' | 'shif';

const PERSONAL_RELIEF = 2400;

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function reportType(value: string | null): StatutoryType {
  if (value === 'p10' || value === 'nssf' || value === 'shif') return value;
  return 'p9';
}

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const { year, month, periodLabel } = parsePeriod(request.nextUrl.searchParams.get('period'));
  const type = reportType(request.nextUrl.searchParams.get('type'));
  const format = parseFormat(request);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const where =
    type === 'p9'
      ? { year }
      : {
          year,
          month,
        };

  const payrollRows = await prisma.payroll.findMany({
    where: { ...where, employee: { outsourcingClientId: workspaceClientId } },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          kraPin: true,
          idNumber: true,
        },
      },
    },
    orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
  });

  let headers: string[] = [];
  let rows: Array<Array<string | number>> = [];

  if (type === 'p9') {
    headers = ['Employee', 'PIN', 'Gross Pay', 'PAYE', 'Personal Relief', 'Insurance Relief'];
    rows = payrollRows.map((row) => [
      `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      row.employee.kraPin ?? '',
      asNumber(row.grossPay).toFixed(2),
      asNumber(row.paye).toFixed(2),
      PERSONAL_RELIEF.toFixed(2),
      '0.00',
    ]);
  } else if (type === 'p10') {
    headers = ['PIN', 'Employee Name', 'Gross Pay', 'Tax Charged', 'Personal Relief', 'PAYE'];
    rows = payrollRows.map((row) => {
      const paye = asNumber(row.paye);
      const taxCharged = paye + PERSONAL_RELIEF;
      return [
        row.employee.kraPin ?? '',
        `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        asNumber(row.grossPay).toFixed(2),
        taxCharged.toFixed(2),
        PERSONAL_RELIEF.toFixed(2),
        paye.toFixed(2),
      ];
    });
  } else if (type === 'nssf') {
    headers = ['ID Number', 'Employee Name', 'Employee Contribution', 'Employer Contribution', 'Total'];
    rows = payrollRows.map((row) => {
      const employeeContribution = asNumber(row.nssf);
      const employerContribution = asNumber(row.nssf);
      return [
        row.employee.idNumber ?? '',
        `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        employeeContribution.toFixed(2),
        employerContribution.toFixed(2),
        (employeeContribution + employerContribution).toFixed(2),
      ];
    });
  } else {
    headers = ['PIN', 'Employee Name', 'Gross Pay', 'SHIF Deduction'];
    rows = payrollRows.map((row) => [
      row.employee.kraPin ?? '',
      `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      asNumber(row.grossPay).toFixed(2),
      asNumber(row.nhif).toFixed(2),
    ]);
  }

  const payload = {
    type,
    period: periodLabel,
    count: rows.length,
    headers,
    rows,
  };

  if (format === 'csv') {
    const csv = toCSV(headers, rows);
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `statutory-${type}-${periodLabel}.csv`),
    });
  }

  return NextResponse.json(payload);
}
