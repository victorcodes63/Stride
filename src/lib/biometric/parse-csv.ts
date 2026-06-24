/**
 * Minimal RFC4180-style CSV: comma-separated, double-quote for quotes; one header row.
 */

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && c === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

const HEADER_ALIASES: Record<string, string> = {
  observedat: 'observedAt',
  at: 'observedAt',
  timestamp: 'observedAt',
  'time (iso)': 'observedAt',
  employeeid: 'employeeId',
  'employee id': 'employeeId',
  'emp id': 'employeeId',
  employeenumber: 'employeeNumber',
  'emp no': 'employeeNumber',
  'emp no.': 'employeeNumber',
  'employee no': 'employeeNumber',
  'employee number': 'employeeNumber',
  externalid: 'externalEventId',
  externaleventid: 'externalEventId',
  'event id': 'externalEventId',
  subject: 'rawSubjectId',
  rawsubjectid: 'rawSubjectId',
  card: 'rawSubjectId',
  direction: 'direction',
  type: 'direction',
};

export type CsvPunchLine = {
  rowIndex1: number;
  observedAt: Date;
  externalEventId: string;
  rawSubjectId: string;
  direction: 'in' | 'out' | 'unknown';
} & (
  | { resolveBy: 'id'; employeeId: string }
  | { resolveBy: 'number'; employeeNumber: string }
);

/**
 * @returns { rows, error } error set when header row is invalid
 */
export function parseBiometricPunchCsv(text: string): { rows: CsvPunchLine[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { rows: [], error: 'CSV must have a header row and at least one data row.' };
  }

  const headerCells = parseLine(lines[0]).map((c) => c.replace(/^"|"$/g, '').trim());
  const colByCanonical: Record<string, number> = {};
  headerCells.forEach((h, i) => {
    const n = normalizeHeader(h);
    const key = HEADER_ALIASES[n] ?? n;
    if (
      [
        'observedAt',
        'employeeId',
        'employeeNumber',
        'externalEventId',
        'rawSubjectId',
        'direction',
      ].includes(key)
    ) {
      colByCanonical[key] = i;
    }
  });

  if (colByCanonical.observedAt == null) {
    return { rows: [], error: 'Missing required column: observedAt (or at, timestamp).' };
  }
  if (colByCanonical.employeeId == null && colByCanonical.employeeNumber == null) {
    return { rows: [], error: 'Missing required column: employeeId or employeeNumber.' };
  }

  const rows: CsvPunchLine[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseLine(lines[li]).map((c) => c.replace(/^"|"$/g, ''));
    const get = (k: string): string | undefined => {
      const idx = colByCanonical[k];
      if (idx == null) return undefined;
      return cells[idx]?.trim() || undefined;
    };
    const observedRaw = get('observedAt');
    if (!observedRaw) continue;
    const observed = new Date(observedRaw);
    if (isNaN(observed.getTime())) {
      return { rows: [], error: `Row ${li + 1}: invalid observedAt "${observedRaw}"` };
    }
    const empId = get('employeeId')?.trim();
    const empNo = get('employeeNumber')?.trim();
    if (!empId && !empNo) {
      return { rows: [], error: `Row ${li + 1}: employeeId or employeeNumber required` };
    }

    const ext = get('externalEventId')?.trim() ?? `csv-row-${li}-${observed.getTime()}`;
    const rawSub = get('rawSubjectId')?.trim() ?? (empNo ?? empId ?? '');
    const dirRaw = get('direction')?.toLowerCase().trim();
    let direction: 'in' | 'out' | 'unknown' = 'unknown';
    if (dirRaw === 'in' || dirRaw === 'i' || dirRaw === 'clock in') direction = 'in';
    else if (dirRaw === 'out' || dirRaw === 'o' || dirRaw === 'clock out') direction = 'out';
    else if (dirRaw === 'unknown' || !dirRaw) direction = 'unknown';

    if (empId) {
      rows.push({
        rowIndex1: li,
        resolveBy: 'id',
        employeeId: empId,
        observedAt: observed,
        externalEventId: ext,
        rawSubjectId: rawSub,
        direction,
      });
    } else {
      rows.push({
        rowIndex1: li,
        resolveBy: 'number',
        employeeNumber: empNo!,
        observedAt: observed,
        externalEventId: ext,
        rawSubjectId: rawSub,
        direction,
      });
    }
  }

  return { rows };
}
