import { parseCsvText } from '@/lib/rota/import-adapter';
import { instantsFromTemplateMinutes } from '@/lib/rota/shift-instants';

/**
 * CSV import adapter for the tenant-own rota. Unlike the outsourcing importer
 * (which matches on employee_number / national id), internal staff are matched
 * by email (preferred) or full name.
 */

export type StaffRotaImportHeader =
  | 'staff'
  | 'work_date'
  | 'shift_template'
  | 'start_time'
  | 'end_time'
  | 'break_minutes'
  | 'notes';

export type StaffRotaImportRow = {
  row: number;
  /** Raw identifier from the file (email or name). */
  staff: string;
  workDate: string;
  shiftTemplateName: string | null;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  notes: string | null;
};

export type StaffRotaImportError = { row: number; message: string; raw?: string };

const HEADER_ALIASES: Record<string, StaffRotaImportHeader> = {
  staff: 'staff',
  email: 'staff',
  'staff email': 'staff',
  'staff_email': 'staff',
  name: 'staff',
  'staff name': 'staff',
  'staff_name': 'staff',
  'full name': 'staff',
  'full_name': 'staff',
  user: 'staff',
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
  return h.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.]+$/g, '');
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
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

export function parseStaffRotaImportCsv(text: string): {
  rows: StaffRotaImportRow[];
  errors: StaffRotaImportError[];
  headers: StaffRotaImportHeader[];
} {
  const grid = parseCsvText(text.replace(/^\uFEFF/, ''));
  const errors: StaffRotaImportError[] = [];
  if (grid.length === 0) {
    return { rows: [], errors: [{ row: 0, message: 'Empty file' }], headers: [] };
  }

  const hrow = grid[0] || [];
  const headerMap = new Map<number, StaffRotaImportHeader>();
  hrow.forEach((cell, idx) => {
    const canon = HEADER_ALIASES[normalizeHeader(String(cell))];
    if (canon) headerMap.set(idx, canon);
  });
  if (!headerMap.size) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message:
            'Header row not recognized. Use columns: staff (email or name), work_date, shift_template (or start_time, end_time), optional break_minutes, notes.',
        },
      ],
      headers: [],
    };
  }

  const get = (line: string[], h: StaffRotaImportHeader) => {
    for (const [i, v] of headerMap) {
      if (v === h) return (line[i] != null ? String(line[i]) : '').trim();
    }
    return '';
  };

  const out: StaffRotaImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] || [];
    const lineNo = r + 1;
    const staff = get(line, 'staff');
    const workDateRaw = get(line, 'work_date');
    const templateName = get(line, 'shift_template') || null;
    const st = get(line, 'start_time');
    const en = get(line, 'end_time');
    const brRaw = get(line, 'break_minutes');
    const notes = get(line, 'notes') || null;

    if (!staff && !workDateRaw) continue;

    if (!staff) {
      errors.push({ row: lineNo, message: 'staff (email or name) is required' });
      continue;
    }
    const workDate = parseYmd(workDateRaw);
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
        staff,
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
        errors.push({ row: lineNo, message: e instanceof Error ? e.message : 'Invalid shift duration' });
        continue;
      }
      out.push({
        row: lineNo,
        staff,
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

export function buildInstantsFromStaffImportRow(
  row: StaffRotaImportRow,
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

/** Normalize a staff identifier (email or name) for matching. */
export function normalizeStaffKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
