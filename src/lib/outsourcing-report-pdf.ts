import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { OutsourcingMonthlyReport } from '@/lib/outsourcing-client-reports';
import { sanitizeHexColor } from '@/lib/brand-theme';

export async function generateOutsourcingReportPdf(report: OutsourcingMonthlyReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = sanitizeHexColor(report.client.reportAccentColor ?? '#FF5436', '#FF5436');
  const accentRgb = hexToRgb(accent);
  const brandName = report.client.whiteLabelReports ? report.client.name : 'Stride HR Outsourcing';

  let y = 780;
  page.drawText('Monthly workforce report', { x: 48, y, size: 10, font, color: rgb(...accentRgb) });
  y -= 22;
  page.drawText(brandName, { x: 48, y, size: 20, font: fontBold, color: rgb(0.1, 0.09, 0.08) });
  y -= 18;
  page.drawText(report.period.label, { x: 48, y, size: 12, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 36;

  const rows: [string, string][] = [
    ['Active headcount', String(report.metrics.activeEmployees)],
    ['New hires', String(report.metrics.newHires)],
    ['Terminations', String(report.metrics.terminations)],
    ['Turnover %', `${report.metrics.turnoverPct}%`],
    ['Payroll gross (KES)', report.metrics.payrollGrossKes.toLocaleString('en-KE')],
    ['Payroll net (KES)', report.metrics.payrollNetKes.toLocaleString('en-KE')],
    ['Leave liability (days)', String(report.metrics.leaveLiabilityDays)],
    ['Statutory returns filed', String(report.metrics.statutoryReturnsFiled)],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 11, font, color: rgb(0.25, 0.25, 0.25) });
    page.drawText(value, { x: 380, y, size: 11, font: fontBold, color: rgb(0.1, 0.09, 0.08) });
    y -= 22;
  }

  page.drawText(
    `Generated ${new Date(report.generatedAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`,
    { x: 48, y: 48, size: 9, font, color: rgb(0.55, 0.55, 0.55) },
  );

  return doc.save();
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const n = Number.parseInt(value, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
