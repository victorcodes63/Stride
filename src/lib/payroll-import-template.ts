import ExcelJS from 'exceljs';

export type PayrollImportRow = {
  excelRow: number;
  nationalId: string;
  employeeName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  daysWorked: number | null;
  incentives: number;
  allowances: number;
  overtime: number;
  holidayPay: number;
  leavePay: number;
  grossPay: number;
};

const HEADER_MAP: Record<string, keyof Omit<PayrollImportRow, 'excelRow'>> = {
  'National ID': 'nationalId',
  'Employee Name': 'employeeName',
  'First Name': 'firstName',
  'Last Name': 'lastName',
  Email: 'email',
  'Days Worked': 'daysWorked',
  Incentives: 'incentives',
  Allowances: 'allowances',
  Overtime: 'overtime',
  'Holiday Pay': 'holidayPay',
  'Leave Pay': 'leavePay',
  'Gross Pay': 'grossPay',
};

function parseString(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') {
    const s = val.trim();
    return s || null;
  }
  if (typeof val === 'object') {
    const v = val as Record<string, unknown>;
    if (typeof v.text === 'string') return parseString(v.text);
    if (v.result !== undefined) return parseString(v.result);
    if (Array.isArray(v.richText)) {
      const s = v.richText
        .map((rt) => {
          const r = rt as Record<string, unknown>;
          return typeof r.text === 'string' ? r.text : '';
        })
        .join('');
      return parseString(s);
    }
  }
  return String(val).trim() || null;
}

function parseNumber(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'object') {
    const v = val as Record<string, unknown>;
    if (v.result !== undefined) return parseNumber(v.result);
    if (typeof v.text === 'string') return parseNumber(v.text);
  }
  if (String(val).trim() === '') return null;
  const n = parseFloat(String(val).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

export async function parsePayrollImportWorkbook(buffer: Uint8Array): Promise<{
  rows: PayrollImportRow[];
  invalidRows: { row: number; reason: string }[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(buffer) as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0]
  );
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], invalidRows: [{ row: 0, reason: 'The Excel file has no worksheets.' }] };
  }

  const maxCols = Math.max(1, sheet.columnCount || sheet.actualColumnCount || 0);
  const allRows: unknown[][] = [];
  sheet.eachRow((row, rowNumber) => {
    const vals: unknown[] = [];
    for (let c = 1; c <= maxCols; c++) vals.push(row.getCell(c).value);
    allRows[rowNumber - 1] = vals;
  });

  if (allRows.length < 2) {
    return { rows: [], invalidRows: [{ row: 0, reason: 'The file has no data rows.' }] };
  }

  let headerRowIndex = -1;
  const maxHeaderSearchRows = Math.min(allRows.length, 8);
  for (let r = 0; r < maxHeaderSearchRows; r++) {
    const row = allRows[r] ?? [];
    const cellStrings = row.map((c) => String(c ?? '').trim().replace(/\s+/g, ' '));
    const hasNationalId = cellStrings.some((c) => c.toLowerCase() === 'national id');
    const hasGrossPay = cellStrings.some((c) => c.toLowerCase() === 'gross pay');
    if (hasNationalId && hasGrossPay) {
      headerRowIndex = r;
      break;
    }
  }
  if (headerRowIndex === -1) headerRowIndex = 0;

  const headerCells = allRows[headerRowIndex] ?? [];
  const colIndex: Partial<Record<keyof PayrollImportRow, number>> = {};
  for (const [header, key] of Object.entries(HEADER_MAP)) {
    const idx = headerCells.findIndex((c) => String(c ?? '').trim() === header);
    if (idx >= 0) colIndex[key] = idx;
  }

  const nationalIdIdx =
    colIndex.nationalId ?? headerCells.findIndex((c) => /national\s*id/i.test(String(c ?? '')));
  const grossPayIdx =
    colIndex.grossPay ?? headerCells.findIndex((c) => /gross\s*pay/i.test(String(c ?? '')));
  if (nationalIdIdx == null || nationalIdIdx < 0 || grossPayIdx == null || grossPayIdx < 0) {
    return {
      rows: [],
      invalidRows: [{ row: headerRowIndex + 1, reason: 'Could not find required columns: National ID and Gross Pay.' }],
    };
  }

  const dataStartRow = headerRowIndex + 1;
  const rows: PayrollImportRow[] = [];
  const invalidRows: { row: number; reason: string }[] = [];

  const getCell = (row: unknown[], key: keyof Omit<PayrollImportRow, 'excelRow'>): unknown => {
    const idx = colIndex[key];
    return idx != null ? row[idx] : undefined;
  };

  for (let r = dataStartRow; r < allRows.length; r++) {
    const row = allRows[r] ?? [];
    const rowNum = r + 1;
    const nationalId = parseString(getCell(row, 'nationalId') ?? row[nationalIdIdx]) ?? '';
    const firstName = parseString(getCell(row, 'firstName'));
    const lastName = parseString(getCell(row, 'lastName'));
    const employeeNameFromColumns = [firstName, lastName].filter(Boolean).join(' ').trim();
    const employeeName =
      parseString(getCell(row, 'employeeName')) || (employeeNameFromColumns || null);
    const isEntirelyEmpty = row.every((c) => parseString(c) == null);
    if (isEntirelyEmpty) continue;
    const grossPayRaw = parseNumber(getCell(row, 'grossPay') ?? row[grossPayIdx]);
    const hasPayrollInput =
      grossPayRaw != null ||
      parseNumber(getCell(row, 'daysWorked')) != null ||
      parseNumber(getCell(row, 'incentives')) != null ||
      parseNumber(getCell(row, 'allowances')) != null ||
      parseNumber(getCell(row, 'overtime')) != null ||
      parseNumber(getCell(row, 'holidayPay')) != null ||
      parseNumber(getCell(row, 'leavePay')) != null;
    // Prefilled employee rows with no payroll values are ignored.
    if (!hasPayrollInput) continue;
    if (!nationalId) {
      invalidRows.push({ row: rowNum, reason: 'National ID is required.' });
      continue;
    }
    if (grossPayRaw == null || grossPayRaw < 0) {
      invalidRows.push({ row: rowNum, reason: 'Gross Pay is required and must be a non-negative number.' });
      continue;
    }
    const daysWorked = parseNumber(getCell(row, 'daysWorked'));
    if (daysWorked != null && daysWorked < 0) {
      invalidRows.push({ row: rowNum, reason: 'Days Worked cannot be negative.' });
      continue;
    }
    const numericSafe = (k: keyof Omit<PayrollImportRow, 'excelRow' | 'nationalId' | 'employeeName' | 'email' | 'daysWorked'>): number => {
      const n = parseNumber(getCell(row, k));
      if (n == null) return 0;
      return n >= 0 ? n : NaN;
    };
    const incentives = numericSafe('incentives');
    const allowances = numericSafe('allowances');
    const overtime = numericSafe('overtime');
    const holidayPay = numericSafe('holidayPay');
    const leavePay = numericSafe('leavePay');
    if ([incentives, allowances, overtime, holidayPay, leavePay].some((v) => Number.isNaN(v))) {
      invalidRows.push({ row: rowNum, reason: 'Input values cannot be negative.' });
      continue;
    }

    rows.push({
      excelRow: rowNum,
      nationalId,
      employeeName,
      firstName,
      lastName,
      email: parseString(getCell(row, 'email')),
      daysWorked,
      incentives,
      allowances,
      overtime,
      holidayPay,
      leavePay,
      grossPay: grossPayRaw,
    });
  }

  return { rows, invalidRows };
}
