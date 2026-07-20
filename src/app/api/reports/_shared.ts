import { NextRequest, NextResponse } from 'next/server';
import { requireStaffUser, type StaffUser } from '@/lib/staff-api-auth';
import { toCSV, toSimplePdf, toTablePdf } from '@/lib/report-export';
import { toXlsx, XLSX_CONTENT_TYPE, type Cell } from '@/lib/excel-export';

export type ReportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

export async function requireReportsUser(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin' && user.role !== 'staff') {
    return { ok: false as const, response: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

/** Role gate for report routes already inside withTenant(). */
export function assertReportsStaffRole(staff: StaffUser): NextResponse | null {
  if (staff.role !== 'admin' && staff.role !== 'staff') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  return null;
}

export function parseFormat(request: NextRequest): ReportFormat {
  const format = request.nextUrl.searchParams.get('format');
  return format === 'csv' || format === 'pdf' || format === 'xlsx' ? format : 'json';
}

export function downloadHeaders(contentType: string, filename: string): HeadersInit {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
  };
}

export function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parsePeriod(periodRaw: string | null): { year: number; month: number; periodLabel: string } {
  const now = new Date();
  const fallbackYear = now.getUTCFullYear();
  const fallbackMonth = now.getUTCMonth() + 1;
  const match = periodRaw?.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return {
      year: fallbackYear,
      month: fallbackMonth,
      periodLabel: `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}`,
    };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return {
      year: fallbackYear,
      month: fallbackMonth,
      periodLabel: `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}`,
    };
  }
  return { year, month, periodLabel: `${year}-${String(month).padStart(2, '0')}` };
}

export async function jsonOrPdf(
  format: ReportFormat,
  payload: unknown,
  title: string,
  filename: string,
  previewLines: string[]
) {
  if (format !== 'pdf') return NextResponse.json(payload);
  const pdf = await toSimplePdf(title, previewLines);
  return new NextResponse(new Uint8Array(pdf), {
    headers: downloadHeaders('application/pdf', filename),
  });
}

export type ReportResponseOptions = {
  format: ReportFormat;
  /** JSON body returned for `format=json` (default). */
  json: unknown;
  /** Human title used for the PDF heading. */
  title: string;
  /** Excel worksheet name (trimmed to 31 chars downstream). */
  sheetName: string;
  /** Filename without extension — the extension is derived from the format. */
  baseFilename: string;
  /** Tabular headers reused across CSV/Excel/PDF. */
  headers: string[];
  /** Tabular rows reused across CSV/Excel/PDF. */
  rows: Cell[][];
  /** Optional summary lines rendered above the PDF table. */
  summaryLines?: string[];
};

/**
 * Single entry point for report downloads. Emits JSON, CSV, Excel (.xlsx), or a
 * tabular PDF from one shared header/row dataset so every format stays in sync.
 */
export async function respondWithReport(options: ReportResponseOptions): Promise<NextResponse> {
  const { format, json, title, sheetName, baseFilename, headers, rows, summaryLines } = options;

  if (format === 'csv') {
    return new NextResponse(toCSV(headers, rows), {
      headers: downloadHeaders('text/csv; charset=utf-8', `${baseFilename}.csv`),
    });
  }

  if (format === 'xlsx') {
    const bytes = await toXlsx(sheetName, headers, rows);
    return new NextResponse(new Uint8Array(bytes), {
      headers: downloadHeaders(XLSX_CONTENT_TYPE, `${baseFilename}.xlsx`),
    });
  }

  if (format === 'pdf') {
    const bytes = await toTablePdf(title, headers, rows, { summaryLines });
    return new NextResponse(new Uint8Array(bytes), {
      headers: downloadHeaders('application/pdf', `${baseFilename}.pdf`),
    });
  }

  return NextResponse.json(json);
}
