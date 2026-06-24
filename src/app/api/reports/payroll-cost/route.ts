import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import { downloadHeaders, jsonOrPdf, parseFormat, parsePeriod, requireReportsUser } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function sumAmounts(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    const amount = Number((item as { amount?: number | string }).amount ?? 0);
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const { year, month, periodLabel } = parsePeriod(request.nextUrl.searchParams.get('period'));
  const format = parseFormat(request);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const payrollRows = await prisma.payroll.findMany({
    where: { year, month, employee: { outsourcingClientId: workspaceClientId } },
    include: {
      employee: {
        select: {
          department: { select: { name: true } },
        },
      },
    },
  });

  const byDepartment = new Map<string, { department: string; gross: number; net: number }>();
  let totalGross = 0;
  let totalNet = 0;
  let totalPAYE = 0;
  let totalNSSF = 0;
  let totalSHIF = 0;
  let totalAHL = 0;
  let totalNITA = 0;
  let totalDeductions = 0;
  let totalAllowances = 0;

  for (const row of payrollRows) {
    const gross = asNumber(row.grossPay);
    const net = asNumber(row.netPay);
    const department = row.employee.department?.name ?? 'Unassigned';

    totalGross += gross;
    totalNet += net;
    totalPAYE += asNumber(row.paye);
    totalNSSF += asNumber(row.nssf);
    totalSHIF += asNumber(row.nhif);
    totalAHL += asNumber(row.ahl);
    totalNITA += asNumber(row.nita);
    totalAllowances += sumAmounts(row.allowances);
    totalDeductions += sumAmounts(row.deductions);

    const current = byDepartment.get(department) ?? { department, gross: 0, net: 0 };
    current.gross += gross;
    current.net += net;
    byDepartment.set(department, current);
  }

  const report = {
    period: periodLabel,
    totalGross: Math.round(totalGross * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
    totalPAYE: Math.round(totalPAYE * 100) / 100,
    totalNSSF: Math.round(totalNSSF * 100) / 100,
    totalSHIF: Math.round(totalSHIF * 100) / 100,
    totalAHL: Math.round(totalAHL * 100) / 100,
    totalNITA: Math.round(totalNITA * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    totalAllowances: Math.round(totalAllowances * 100) / 100,
    byDepartment: Array.from(byDepartment.values()).sort((a, b) => b.gross - a.gross),
    headcount: payrollRows.length,
    averageSalary: payrollRows.length > 0 ? Math.round((totalGross / payrollRows.length) * 100) / 100 : 0,
  };

  if (format === 'csv') {
    const csv = toCSV(
      ['Department', 'Gross', 'Net'],
      report.byDepartment.map((row) => [row.department, row.gross.toFixed(2), row.net.toFixed(2)])
    );
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `payroll-cost-${periodLabel}.csv`),
    });
  }

  return jsonOrPdf(
    format,
    report,
    'Payroll Cost Report',
    `payroll-cost-${periodLabel}.pdf`,
    [
      `Period: ${periodLabel}`,
      `Headcount: ${report.headcount}`,
      `Total gross: ${report.totalGross.toFixed(2)}`,
      `Total net: ${report.totalNet.toFixed(2)}`,
      `PAYE: ${report.totalPAYE.toFixed(2)}`,
      `NSSF: ${report.totalNSSF.toFixed(2)}`,
      `SHIF: ${report.totalSHIF.toFixed(2)}`,
      `AHL: ${report.totalAHL.toFixed(2)}`,
      `NITA: ${report.totalNITA.toFixed(2)}`,
    ]
  );
}
