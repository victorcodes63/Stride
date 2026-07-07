/**
 * OUT-08 — Per-end-client workforce report pack (white-label ready).
 */
import type { Prisma } from '@prisma/client';

export type OutsourcingReportSection =
  | 'headcount'
  | 'turnover'
  | 'payroll_cost'
  | 'leave_liability'
  | 'statutory';

export type OutsourcingMonthlyReport = {
  generatedAt: string;
  period: { month: number; year: number; label: string };
  client: {
    id: string;
    name: string;
    whiteLabelReports: boolean;
    clientLogoUrl: string | null;
    reportAccentColor: string | null;
    reportRecipientEmails: string[];
  };
  sections: OutsourcingReportSection[];
  metrics: {
    headcount: number;
    activeEmployees: number;
    newHires: number;
    terminations: number;
    turnoverPct: number;
    payrollGrossKes: number;
    payrollNetKes: number;
    leaveLiabilityDays: number;
    statutoryReturnsFiled: number;
  };
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function parseReportSections(value: unknown): OutsourcingReportSection[] {
  const allowed: OutsourcingReportSection[] = [
    'headcount',
    'turnover',
    'payroll_cost',
    'leave_liability',
    'statutory',
  ];
  if (!Array.isArray(value)) return allowed;
  const picked = value.filter(
    (v): v is OutsourcingReportSection =>
      typeof v === 'string' && allowed.includes(v as OutsourcingReportSection),
  );
  return picked.length > 0 ? picked : allowed;
}

export function parseReportRecipientEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.includes('@'));
}

export async function buildOutsourcingMonthlyReport(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; outsourcingClientId: string; month: number; year: number },
): Promise<OutsourcingMonthlyReport> {
  const periodStart = new Date(Date.UTC(input.year, input.month - 1, 1));
  const periodEnd = new Date(Date.UTC(input.year, input.month, 1));

  const client = await tx.outsourcingClient.findFirst({
    where: { id: input.outsourcingClientId, organizationId: input.organizationId },
    select: {
      id: true,
      name: true,
      whiteLabelReports: true,
      clientLogoUrl: true,
      reportAccentColor: true,
      reportRecipientEmails: true,
      reportSections: true,
    },
  });
  if (!client) {
    throw Object.assign(new Error('OUTSOURCING_CLIENT_NOT_FOUND'), { code: 'OUTSOURCING_CLIENT_NOT_FOUND' });
  }

  const [activeEmployees, newHires, terminations, payrollAgg, leaveBalances, statutoryCount] =
    await Promise.all([
      tx.employee.count({
        where: {
          organizationId: input.organizationId,
          outsourcingClientId: input.outsourcingClientId,
          employmentStatus: 'active',
        },
      }),
      tx.employee.count({
        where: {
          organizationId: input.organizationId,
          outsourcingClientId: input.outsourcingClientId,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      tx.employeeLifecycleEvent.count({
        where: {
          organizationId: input.organizationId,
          outsourcingClientId: input.outsourcingClientId,
          eventType: 'separation',
          effectiveDate: { gte: periodStart, lt: periodEnd },
        },
      }),
      tx.payroll.aggregate({
        where: {
          organizationId: input.organizationId,
          month: input.month,
          year: input.year,
          employee: { outsourcingClientId: input.outsourcingClientId },
        },
        _sum: { grossPay: true, netPay: true },
      }),
      tx.leaveBalance.aggregate({
        where: {
          organizationId: input.organizationId,
          employee: { outsourcingClientId: input.outsourcingClientId, employmentStatus: 'active' },
        },
        _sum: { balance: true },
      }),
      tx.statutoryReturn.count({
        where: {
          organizationId: input.organizationId,
          outsourcingClientId: input.outsourcingClientId,
          month: input.month,
          year: input.year,
          status: { in: ['filed', 'paid'] },
        },
      }),
    ]);

  const headcount = activeEmployees;
  const turnoverPct =
    headcount > 0 ? Math.round((terminations / Math.max(headcount, 1)) * 1000) / 10 : 0;

  return {
    generatedAt: new Date().toISOString(),
    period: {
      month: input.month,
      year: input.year,
      label: `${MONTH_NAMES[input.month - 1] ?? input.month} ${input.year}`,
    },
    client: {
      id: client.id,
      name: client.name,
      whiteLabelReports: client.whiteLabelReports,
      clientLogoUrl: client.clientLogoUrl,
      reportAccentColor: client.reportAccentColor,
      reportRecipientEmails: parseReportRecipientEmails(client.reportRecipientEmails),
    },
    sections: parseReportSections(client.reportSections),
    metrics: {
      headcount,
      activeEmployees,
      newHires,
      terminations,
      turnoverPct,
      payrollGrossKes: Number(payrollAgg._sum.grossPay ?? 0),
      payrollNetKes: Number(payrollAgg._sum.netPay ?? 0),
      leaveLiabilityDays: Number(leaveBalances._sum.balance ?? 0),
      statutoryReturnsFiled: statutoryCount,
    },
  };
}

export function renderOutsourcingReportHtml(report: OutsourcingMonthlyReport): string {
  const accent = report.client.reportAccentColor?.trim() || '#FF5436';
  const logo = report.client.clientLogoUrl?.trim();
  const brandName = report.client.whiteLabelReports ? report.client.name : 'Stride HR Outsourcing';

  const rows = [
    ['Active headcount', String(report.metrics.activeEmployees)],
    ['New hires', String(report.metrics.newHires)],
    ['Terminations', String(report.metrics.terminations)],
    ['Turnover %', `${report.metrics.turnoverPct}%`],
    ['Payroll gross (KES)', report.metrics.payrollGrossKes.toLocaleString('en-KE')],
    ['Payroll net (KES)', report.metrics.payrollNetKes.toLocaleString('en-KE')],
    ['Leave liability (days)', String(report.metrics.leaveLiabilityDays)],
    ['Statutory returns filed', String(report.metrics.statutoryReturnsFiled)],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#444;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;text-align:right;">${value}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${brandName} — Workforce report ${report.period.label}</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f8f6f3;margin:0;padding:32px;color:#1a1714;">
  <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
      ${logo ? `<img src="${logo}" alt="" style="height:48px;max-width:180px;object-fit:contain;" />` : ''}
      <div>
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${accent};">Monthly workforce report</p>
        <h1 style="margin:4px 0 0;font-size:24px;">${brandName}</h1>
        <p style="margin:4px 0 0;color:#666;">${report.period.label}</p>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    <p style="margin-top:24px;font-size:12px;color:#888;">Generated ${new Date(report.generatedAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} · Powered by Stride</p>
  </div>
</body>
</html>`;
}
