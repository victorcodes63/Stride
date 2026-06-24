import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export function toCSV(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const headerLine = headers.map(escapeCell).join(',');
  const dataLines = rows.map((row) => row.map((cell) => escapeCell(cell ?? '')).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function escapeCell(cell: string | number): string {
  const str = String(cell ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export async function toSimplePdf(title: string, lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(title, { x: 40, y: 800, size: 18, font: bold, color: rgb(0.07, 0.12, 0.16) });

  let y = 772;
  for (const line of lines) {
    if (y < 40) break;
    page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 14;
  }

  return doc.save();
}
