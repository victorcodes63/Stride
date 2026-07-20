import ExcelJS from 'exceljs';

export type Cell = string | number | null | undefined;

const HEADER_FILL = 'FF0F2A3D';
const HEADER_FONT = 'FFFFFFFF';

function normalizeCell(value: Cell): string | number {
  if (value === null || value === undefined) return '';
  return typeof value === 'number' && Number.isFinite(value) ? value : String(value);
}

/**
 * Build a single-sheet .xlsx workbook from headers + rows and return the raw
 * bytes suitable for a NextResponse download body.
 */
export async function toXlsx(
  sheetName: string,
  headers: string[],
  rows: Cell[][],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Stride';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Report', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row.map(normalizeCell));
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: HEADER_FONT } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1);
    let maxLength = header.length;
    for (const row of rows) {
      const value = row[index];
      const length = value === null || value === undefined ? 0 : String(value).length;
      if (length > maxLength) maxLength = length;
    }
    column.width = Math.min(60, Math.max(10, maxLength + 2));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
