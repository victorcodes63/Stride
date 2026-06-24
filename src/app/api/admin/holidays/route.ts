import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { requireDashboardAdmin } from '@/lib/require-dashboard-admin';
import { clearHolidayCache, getHolidaysForYear } from '@/lib/holidays';

function parseDateInput(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const yearRaw = request.nextUrl.searchParams.get('year');
  if (yearRaw) {
    const year = parseInt(yearRaw, 10);
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter.' }, { status: 400 });
    }
    const resolved = await getHolidaysForYear(year);
    return NextResponse.json(resolved);
  }

  const list = await prisma.publicHoliday.findMany({ orderBy: [{ recurring: 'desc' }, { date: 'asc' }] });
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const adminError = await requireDashboardAdmin(request);
  if (adminError) return adminError;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const recurring = Boolean(body.recurring);
  const recurDay =
    typeof body.recurDay === 'number' ? body.recurDay : parseInt(String(body.recurDay ?? ''), 10);
  const recurMonth =
    typeof body.recurMonth === 'number'
      ? body.recurMonth
      : parseInt(String(body.recurMonth ?? ''), 10);
  const date = parseDateInput(body.date);

  if (!name) return NextResponse.json({ error: 'Holiday name is required.' }, { status: 400 });
  if (recurring) {
    if (!Number.isInteger(recurDay) || recurDay < 1 || recurDay > 31) {
      return NextResponse.json({ error: 'Recurring holiday requires valid recurDay.' }, { status: 400 });
    }
    if (!Number.isInteger(recurMonth) || recurMonth < 1 || recurMonth > 12) {
      return NextResponse.json({ error: 'Recurring holiday requires valid recurMonth.' }, { status: 400 });
    }
  } else if (!date) {
    return NextResponse.json({ error: 'Specific holiday requires valid date.' }, { status: 400 });
  }

  try {
    const created = await prisma.publicHoliday.create({
      data: {
        name,
        recurring,
        date: recurring ? null : date,
        recurDay: recurring ? recurDay : null,
        recurMonth: recurring ? recurMonth : null,
        notes: typeof body.notes === 'string' ? body.notes.trim() : null,
        isActive: body.isActive == null ? true : Boolean(body.isActive),
      },
    });
    clearHolidayCache();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[admin/holidays POST]', error);
    return NextResponse.json({ error: 'Failed to create holiday.' }, { status: 500 });
  }
}
