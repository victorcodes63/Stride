import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PRIMARY = rgb(26 / 255, 23 / 255, 20 / 255);
const GRAY_600 = rgb(82 / 255, 82 / 255, 82 / 255);
const BORDER = rgb(229 / 255, 229 / 255, 229 / 255);

export type LpoPdfInput = {
  lpoNumber: string;
  title: string;
  clientName: string;
  vendorName: string;
  currency: string;
  status: string;
  issuedAt: string | null;
  purchaseRequestNumber: string | null;
  lines: Array<{
    item: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
  }>;
};

function fmtMoney(v: number, currency: string): string {
  return `${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export async function buildLpoPdf(input: LpoPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let y = height - margin;

  page.drawText('Stride', { x: margin, y, size: 14, font: fontBold, color: PRIMARY });
  y -= 22;
  page.drawText('Local Purchase Order', { x: margin, y, size: 16, font: fontBold, color: PRIMARY });
  y -= 20;
  page.drawText(input.lpoNumber, { x: margin, y, size: 12, font: fontBold, color: PRIMARY });
  y -= 24;

  const meta = [
    `Client: ${input.clientName}`,
    `Vendor: ${input.vendorName}`,
    `Status: ${input.status}`,
    input.issuedAt ? `Issued: ${input.issuedAt.split('T')[0]}` : 'Issued: —',
    input.purchaseRequestNumber ? `Purchase request: ${input.purchaseRequestNumber}` : null,
  ].filter(Boolean) as string[];

  for (const line of meta) {
    page.drawText(line, { x: margin, y, size: 10, font, color: GRAY_600 });
    y -= 14;
  }
  y -= 8;
  page.drawText(input.title, { x: margin, y, size: 11, font: fontBold, color: PRIMARY });
  y -= 20;

  const cols = [
    { label: 'Item', w: 140 },
    { label: 'Qty', w: 50 },
    { label: 'Unit price', w: 80 },
    { label: 'Line total', w: 80 },
  ];
  let x = margin;
  for (const col of cols) {
    page.drawText(col.label, { x, y, size: 9, font: fontBold, color: PRIMARY });
    x += col.w;
  }
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: BORDER });
  y -= 14;

  let total = 0;
  for (const line of input.lines) {
    const lineTotal = Math.round(line.quantity * line.unitPrice * 100) / 100;
    total += lineTotal;
    x = margin;
    const row = [
      line.item.slice(0, 32),
      String(line.quantity),
      fmtMoney(line.unitPrice, input.currency),
      fmtMoney(lineTotal, input.currency),
    ];
    for (let i = 0; i < cols.length; i++) {
      page.drawText(row[i], { x, y, size: 9, font, color: PRIMARY });
      x += cols[i].w;
    }
    y -= 14;
    if (line.description) {
      page.drawText(line.description.slice(0, 60), { x: margin + 8, y, size: 8, font, color: GRAY_600 });
      y -= 12;
    }
  }

  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: BORDER });
  y -= 16;
  page.drawText(`Total: ${fmtMoney(total, input.currency)}`, {
    x: width - margin - 160,
    y,
    size: 11,
    font: fontBold,
    color: PRIMARY,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
