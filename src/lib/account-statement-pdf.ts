import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ClientStatement, StatementEntry, VendorStatement } from '@/lib/accounts/statements';

const PRIMARY = rgb(26 / 255, 23 / 255, 20 / 255);
const GRAY_600 = rgb(82 / 255, 82 / 255, 82 / 255);
const BORDER = rgb(229 / 255, 229 / 255, 229 / 255);

function fmtMoney(v: number, currency: string): string {
  return `${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

async function drawStatementPdf(input: {
  title: string;
  partyLabel: string;
  partyName: string;
  currency: string;
  entries: StatementEntry[];
  summaryLines: Array<{ label: string; value: string }>;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let y = height - margin;

  page.drawText('Stride', { x: margin, y, size: 14, font: fontBold, color: PRIMARY });
  y -= 22;
  page.drawText(input.title, { x: margin, y, size: 16, font: fontBold, color: PRIMARY });
  y -= 18;
  page.drawText(`${input.partyLabel}: ${input.partyName}`, { x: margin, y, size: 11, font, color: GRAY_600 });
  y -= 14;
  page.drawText(`Generated: ${new Date().toISOString().split('T')[0]}`, { x: margin, y, size: 10, font, color: GRAY_600 });
  y -= 24;

  const cols = [
    { label: 'Date', w: 62 },
    { label: 'Ref', w: 72 },
    { label: 'Description', w: 170 },
    { label: 'Debit', w: 68 },
    { label: 'Credit', w: 68 },
    { label: 'Balance', w: 68 },
  ];
  let x = margin;
  for (const col of cols) {
    page.drawText(col.label, { x, y, size: 9, font: fontBold, color: PRIMARY });
    x += col.w;
  }
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: BORDER });
  y -= 14;

  for (const entry of input.entries) {
    if (y < margin + 80) break;
    x = margin;
    const row = [
      entry.date,
      entry.reference.slice(0, 14),
      entry.description.slice(0, 28),
      entry.debit > 0 ? fmtMoney(entry.debit, '') : '—',
      entry.credit > 0 ? fmtMoney(entry.credit, '') : '—',
      fmtMoney(entry.balance, ''),
    ];
    for (let i = 0; i < cols.length; i += 1) {
      page.drawText(row[i]!, { x, y, size: 8, font, color: PRIMARY });
      x += cols[i]!.w;
    }
    y -= 12;
  }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: BORDER });
  y -= 18;
  for (const line of input.summaryLines) {
    page.drawText(`${line.label}: ${line.value}`, { x: margin, y, size: 10, font: fontBold, color: PRIMARY });
    y -= 14;
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export async function generateClientStatementPdf(statement: ClientStatement): Promise<Buffer> {
  return drawStatementPdf({
    title: 'Statement of Account — Debtor',
    partyLabel: 'Client',
    partyName: statement.clientName,
    currency: statement.currency,
    entries: statement.entries,
    summaryLines: [
      { label: 'Total invoiced', value: fmtMoney(statement.summary.totalInvoiced, statement.currency) },
      { label: 'Total paid', value: fmtMoney(statement.summary.totalPaid, statement.currency) },
      { label: 'Closing balance', value: fmtMoney(statement.summary.closingBalance, statement.currency) },
    ],
  });
}

export async function generateVendorStatementPdf(statement: VendorStatement): Promise<Buffer> {
  return drawStatementPdf({
    title: 'Statement of Account — Creditor',
    partyLabel: 'Vendor',
    partyName: statement.vendorName,
    currency: statement.currency,
    entries: statement.entries,
    summaryLines: [
      { label: 'Total billed', value: fmtMoney(statement.summary.totalBilled, statement.currency) },
      { label: 'Total paid', value: fmtMoney(statement.summary.totalPaid, statement.currency) },
      { label: 'Amount owing', value: fmtMoney(statement.summary.closingBalance, statement.currency) },
    ],
  });
}
