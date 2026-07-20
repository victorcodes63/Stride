import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

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

type TablePdfOptions = {
  /** Summary lines rendered above the table (e.g. totals, period). */
  summaryLines?: string[];
  /** Cap on data rows rendered into the PDF. */
  maxRows?: number;
};

const PAGE_WIDTH = 842; // A4 landscape — more room for tabular data
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const ROW_HEIGHT = 16;
const HEADER_SIZE = 9;
const CELL_SIZE = 8;

const INK = rgb(0.07, 0.12, 0.16);
const HEADER_BG = rgb(0.06, 0.16, 0.24);
const HEADER_TEXT = rgb(1, 1, 1);
const ROW_STRIPE = rgb(0.95, 0.96, 0.98);
const BODY_TEXT = rgb(0.1, 0.12, 0.15);

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let str = text;
  while (str.length > 1 && font.widthOfTextAtSize(`${str}…`, size) > maxWidth) {
    str = str.slice(0, -1);
  }
  return `${str}…`;
}

/**
 * Render a paginated, striped data table into a PDF. Columns are sized evenly
 * across the printable width; long cells are truncated to fit.
 */
export async function toTablePdf(
  title: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  options: TablePdfOptions = {},
): Promise<Uint8Array> {
  const { summaryLines = [], maxRows = 2000 } = options;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const columnCount = Math.max(1, headers.length);
  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const columnWidth = usableWidth / columnCount;
  const cellPadding = 4;
  const dataRows = rows.slice(0, maxRows);

  let page: PDFPage | null = null;
  let y = 0;

  const drawHeaderRow = () => {
    if (!page) return;
    page.drawRectangle({
      x: MARGIN,
      y: y - ROW_HEIGHT + 4,
      width: usableWidth,
      height: ROW_HEIGHT,
      color: HEADER_BG,
    });
    headers.forEach((header, index) => {
      const text = truncateToWidth(String(header), bold, HEADER_SIZE, columnWidth - cellPadding * 2);
      page!.drawText(text, {
        x: MARGIN + index * columnWidth + cellPadding,
        y: y - ROW_HEIGHT + 9,
        size: HEADER_SIZE,
        font: bold,
        color: HEADER_TEXT,
      });
    });
    y -= ROW_HEIGHT;
  };

  const newPage = (withTitle: boolean) => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    if (withTitle) {
      page.drawText(title, { x: MARGIN, y: y - 6, size: 15, font: bold, color: INK });
      y -= 24;
      for (const line of summaryLines) {
        page.drawText(truncateToWidth(line, font, 9, usableWidth), {
          x: MARGIN,
          y: y - 4,
          size: 9,
          font,
          color: BODY_TEXT,
        });
        y -= 13;
      }
      if (summaryLines.length > 0) y -= 6;
    }
    drawHeaderRow();
  };

  newPage(true);

  dataRows.forEach((row, rowIndex) => {
    if (y - ROW_HEIGHT < MARGIN) {
      newPage(false);
    }
    if (rowIndex % 2 === 1 && page) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_HEIGHT + 4,
        width: usableWidth,
        height: ROW_HEIGHT,
        color: ROW_STRIPE,
      });
    }
    headers.forEach((_, colIndex) => {
      const raw = row[colIndex];
      const text = truncateToWidth(String(raw ?? ''), font, CELL_SIZE, columnWidth - cellPadding * 2);
      page!.drawText(text, {
        x: MARGIN + colIndex * columnWidth + cellPadding,
        y: y - ROW_HEIGHT + 9,
        size: CELL_SIZE,
        font,
        color: BODY_TEXT,
      });
    });
    y -= ROW_HEIGHT;
  });

  if (rows.length > dataRows.length && page) {
    if (y - ROW_HEIGHT < MARGIN) newPage(false);
    (page as PDFPage).drawText(
      `… ${rows.length - dataRows.length} more rows omitted. Export CSV or Excel for the full dataset.`,
      { x: MARGIN, y: y - ROW_HEIGHT + 9, size: CELL_SIZE, font, color: BODY_TEXT },
    );
  }

  return doc.save();
}
