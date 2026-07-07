import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type FleetPerformanceReportPayload = {
  periodDays: number;
  trips: { total: number; delivered: number; onTimePct: number };
  fleet: { utilizationPct: number };
  fuel: { spendKes: number };
  settlements: { totalAmountKes: number };
  transporterScorecard: { payeeName: string; tripCount: number; totalPaidKes: number }[];
};

export async function generateFleetPerformancePdf(
  report: FleetPerformanceReportPayload,
  title = 'Fleet performance report',
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  page.drawText(title, { x: 48, y, size: 18, font: fontBold, color: rgb(0.1, 0.09, 0.08) });
  y -= 20;
  page.drawText(`Last ${report.periodDays} days`, { x: 48, y, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 32;

  const rows: [string, string][] = [
    ['Trips', String(report.trips.total)],
    ['Delivered', String(report.trips.delivered)],
    ['On-time %', `${report.trips.onTimePct}%`],
    ['Fleet utilisation', `${report.fleet.utilizationPct}%`],
    ['Fuel spend (KES)', report.fuel.spendKes.toLocaleString('en-KE')],
    ['Settlements (KES)', report.settlements.totalAmountKes.toLocaleString('en-KE')],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 11, font });
    page.drawText(value, { x: 360, y, size: 11, font: fontBold });
    y -= 20;
  }

  if (report.transporterScorecard.length > 0) {
    y -= 12;
    page.drawText('Transporter scorecard', { x: 48, y, size: 12, font: fontBold });
    y -= 18;
    for (const row of report.transporterScorecard.slice(0, 8)) {
      page.drawText(`${row.payeeName} — ${row.tripCount} trips`, { x: 48, y, size: 10, font });
      page.drawText(`KES ${row.totalPaidKes.toLocaleString('en-KE')}`, { x: 360, y, size: 10, font });
      y -= 16;
    }
  }

  return doc.save();
}
