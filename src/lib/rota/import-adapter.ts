import { instantsFromTemplateMinutes } from '@/lib/rota/shift-instants';

export type RotaImportHeader =
  | 'employee_number'
  | 'work_date'
  | 'shift_template'
  | 'start_time'
  | 'end_time'
  | 'break_minutes'
  | 'notes';

export type RotaImportRow = {
  row: number;
  employeeNumber: string;
  workDate: string;
  shiftTemplateName: string | null;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  notes: string | null;
};

export type RotaImportError = { row: number; message: string; raw?: string };

const HEADER_ALIASES: Record<string, RotaImportHeader> = {
  employee_number: 'employee_number',
  emp_no: 'employee_number',
  'emp no': 'employee_number',
  'emp no.': 'employee_number',
  'emp_no.': 'employee_number',
  'employee no': 'employee_number',
  'employee no.': 'employee_number',
  work_date: 'work_date',
  date: 'work_date',
  'work date': 'work_date',
  shift_template: 'shift_template',
  template: 'shift_template',
  'shift name': 'shift_template',
  start_time: 'start_time',
  start: 'start_time',
  'shift start': 'start_time',
  end_time: 'end_time',
  end: 'end_time',
  'shift end': 'end_time',
  break_minutes: 'break_minutes',
  break: 'break_minutes',
  notes: 'notes',
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '');
}

/** Minimal CSV line parser: supports quoted fields with doubled quotes. */
export function parseCsvText(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let i = 0;
  let inQ = false;

  const pushCell = () => {
    row.push(cur);
    cur = '';
  };

  while (i < content.length) {
    const c = content[i]!;
    if (inQ) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      pushCell();
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      pushCell();
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  pushCell();
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
    rows.push(row);
  }
  return rows;
}

function parseHm(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function parseYmd(s: string): string | null {
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  return t;
}

/**
 * Parse rota assignment CSV. First row must be headers.
 * Required: employee_number, work_date, and either shift_template (name) or start_time + end_time (HH:mm).
 */
export function parseRotaImportCsv(text: string): {
  rows: RotaImportRow[];
  errors: RotaImportError[];
  headers: RotaImportHeader[];
} {
  const grid = parseCsvText(text.replace(/^\uFEFF/, ''));
  const errors: RotaImportError[] = [];
  if (grid.length === 0) {
    return { rows: [], errors: [{ row: 0, message: 'Empty file' }], headers: [] };
  }

  const hrow = grid[0] || [];
  const headerMap = new Map<number, RotaImportHeader>();
  hrow.forEach((cell, idx) => {
    const k = normalizeHeader(String(cell));
    const canon = (HEADER_ALIASES as Record<string, RotaImportHeader>)[k];
    if (canon) headerMap.set(idx, canon);
  });
  if (!headerMap.size) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message:
            'Header row not recognized. Use columns: employee_number, work_date, shift_template (or start_time, end_time), optional break_minutes, notes.',
        },
      ],
      headers: [],
    };
  }

  const get = (line: string[], h: RotaImportHeader) => {
    for (const [i, v] of headerMap) {
      if (v === h) return (line[i] != null ? String(line[i]) : '').trim();
    }
    return '';
  };

  const out: RotaImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] || [];
    const lineNo = r + 1;
    const employeeNumber = get(line, 'employee_number');
    const workDateRaw = get(line, 'work_date');
    const templateName = get(line, 'shift_template') || null;
    const st = get(line, 'start_time');
    const en = get(line, 'end_time');
    const brRaw = get(line, 'break_minutes');
    const notes = get(line, 'notes') || null;

    if (!employeeNumber && !workDateRaw) continue;

    const workDate = parseYmd(workDateRaw);
    if (!employeeNumber) {
      errors.push({ row: lineNo, message: 'employee_number is required' });
      continue;
    }
    if (!workDate) {
      errors.push({ row: lineNo, message: 'work_date must be YYYY-MM-DD', raw: workDateRaw });
      continue;
    }

    let breakMinutes = 0;
    if (brRaw) {
      const n = parseInt(brRaw, 10);
      if (!Number.isFinite(n) || n < 0) {
        errors.push({ row: lineNo, message: 'break_minutes must be a non-negative integer' });
        continue;
      }
      breakMinutes = n;
    }

    if (templateName) {
      out.push({
        row: lineNo,
        employeeNumber,
        workDate,
        shiftTemplateName: templateName,
        startTime: null,
        endTime: null,
        breakMinutes,
        notes,
      });
    } else {
      const sm = parseHm(st);
      const em = parseHm(en);
      if (sm == null || em == null) {
        errors.push({
          row: lineNo,
          message: 'Provide shift_template or both start_time and end_time (HH:mm)',
        });
        continue;
      }
      try {
        instantsFromTemplateMinutes(workDate, sm, em);
      } catch (e) {
        errors.push({
          row: lineNo,
          message: e instanceof Error ? e.message : 'Invalid shift duration',
        });
        continue;
      }
      out.push({
        row: lineNo,
        employeeNumber,
        workDate,
        shiftTemplateName: null,
        startTime: st,
        endTime: en,
        breakMinutes,
        notes,
      });
    }
  }

  const headers = Array.from(new Set(headerMap.values()));
  return { rows: out, errors, headers };
}

export function buildInstantsFromImportRow(
  row: RotaImportRow,
  template: { startMinutes: number; endMinutes: number },
): { startsAt: Date; endsAt: Date } {
  if (row.shiftTemplateName) {
    return instantsFromTemplateMinutes(row.workDate, template.startMinutes, template.endMinutes);
  }
  const sm = parseHm(row.startTime);
  const em = parseHm(row.endTime);
  if (sm == null || em == null) {
    throw new Error('start_time and end_time required when no template name');
  }
  return instantsFromTemplateMinutes(row.workDate, sm, em);
}
