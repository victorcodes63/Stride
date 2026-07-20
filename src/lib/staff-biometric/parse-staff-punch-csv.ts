/**
 * Internal-staff biometric punch CSV parser.
 *
 * Modeled on `@/lib/biometric/parse-csv` (outsourcing, keyed on Employee), but
 * keyed on the device's raw subject id — internal staff punches resolve to a
 * User via the device `subjectMap`, not by an Employee number.
 *
 * Minimal RFC4180-style CSV: comma-separated, double-quote for escaping, one
 * header row. Column order is free; headers are matched by alias.
 *
 * Required columns:
 *   - observedAt (aliases: at, timestamp, time, date/time)
 *   - subject    (aliases: rawSubjectId, card, badge, employee id, emp no, user id)
 * Optional columns:
 *   - externalEventId (aliases: external id, event id, serial, serialno)
 *   - direction       (aliases: type, event; values in/out/unknown)
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
  time: 'observedAt',
  'time (iso)': 'observedAt',
  datetime: 'observedAt',
  'date/time': 'observedAt',
  subject: 'rawSubjectId',
  rawsubjectid: 'rawSubjectId',
  'raw subject id': 'rawSubjectId',
  card: 'rawSubjectId',
  'card no': 'rawSubjectId',
  'card no.': 'rawSubjectId',
  badge: 'rawSubjectId',
  'badge id': 'rawSubjectId',
  'employee id': 'rawSubjectId',
  employeeid: 'rawSubjectId',
  'emp id': 'rawSubjectId',
  'emp no': 'rawSubjectId',
  'emp no.': 'rawSubjectId',
  'employee no': 'rawSubjectId',
  'employee number': 'rawSubjectId',
  'user id': 'rawSubjectId',
  userid: 'rawSubjectId',
  externalid: 'externalEventId',
  'external id': 'externalEventId',
  externaleventid: 'externalEventId',
  'event id': 'externalEventId',
  serial: 'externalEventId',
  serialno: 'externalEventId',
  'serial no': 'externalEventId',
  direction: 'direction',
  type: 'direction',
  event: 'direction',
};

const CANONICAL_COLUMNS = ['observedAt', 'rawSubjectId', 'externalEventId', 'direction'] as const;

export type StaffCsvPunchRow = {
  rowIndex1: number;
  observedAt: Date;
  rawSubjectId: string;
  externalEventId: string;
  direction: 'in' | 'out' | 'unknown';
};

function normalizeDirection(raw: string | undefined): 'in' | 'out' | 'unknown' {
  const d = raw?.toLowerCase().trim();
  if (d === 'in' || d === 'i' || d === 'clock in' || d === 'checkin' || d === 'check in' || d === 'entry') {
    return 'in';
  }
  if (d === 'out' || d === 'o' || d === 'clock out' || d === 'checkout' || d === 'check out' || d === 'exit') {
    return 'out';
  }
  return 'unknown';
}

/** @returns `{ rows, error }` — `error` is set when the header/data is invalid. */
export function parseStaffPunchCsv(text: string): { rows: StaffCsvPunchRow[]; error?: string } {
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
    if ((CANONICAL_COLUMNS as readonly string[]).includes(key) && colByCanonical[key] == null) {
      colByCanonical[key] = i;
    }
  });

  if (colByCanonical.observedAt == null) {
    return { rows: [], error: 'Missing required column: observedAt (aliases: at, timestamp, time).' };
  }
  if (colByCanonical.rawSubjectId == null) {
    return {
      rows: [],
      error: 'Missing required column: subject (aliases: rawSubjectId, card, badge, employee id).',
    };
  }

  const rows: StaffCsvPunchRow[] = [];
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
    if (Number.isNaN(observed.getTime())) {
      return { rows: [], error: `Row ${li + 1}: invalid observedAt "${observedRaw}".` };
    }

    const rawSubjectId = get('rawSubjectId');
    if (!rawSubjectId) {
      return { rows: [], error: `Row ${li + 1}: subject is required.` };
    }

    const direction = normalizeDirection(get('direction'));
    const externalEventId =
      get('externalEventId') ?? `csv-${rawSubjectId}-${observed.getTime()}-${direction}`;

    rows.push({
      rowIndex1: li,
      observedAt: observed,
      rawSubjectId,
      externalEventId,
      direction,
    });
  }

  if (rows.length === 0) {
    return { rows: [], error: 'No valid data rows found in CSV.' };
  }

  return { rows };
}

/** Collapse rows sharing an `externalEventId` (last one wins), returning dupe count. */
export function dedupeStaffCsvRows(rows: StaffCsvPunchRow[]): {
  unique: StaffCsvPunchRow[];
  duplicateInFile: number;
} {
  const byExternal = new Map<string, StaffCsvPunchRow>();
  let duplicateInFile = 0;
  for (const row of rows) {
    if (byExternal.has(row.externalEventId)) duplicateInFile += 1;
    byExternal.set(row.externalEventId, row);
  }
  return { unique: [...byExternal.values()], duplicateInFile };
}
