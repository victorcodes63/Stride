import { NextRequest, NextResponse } from 'next/server';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { toSimplePdf } from '@/lib/report-export';

export async function requireReportsUser(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin' && user.role !== 'staff') {
    return { ok: false as const, response: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

export function parseFormat(request: NextRequest): 'json' | 'csv' | 'pdf' {
  const format = request.nextUrl.searchParams.get('format');
  return format === 'csv' || format === 'pdf' ? format : 'json';
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
  format: 'json' | 'csv' | 'pdf',
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
