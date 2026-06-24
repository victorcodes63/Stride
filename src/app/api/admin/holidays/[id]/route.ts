import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { requireDashboardAdmin } from '@/lib/require-dashboard-admin';
import { clearHolidayCache } from '@/lib/holidays';

function parseDateInput(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const row = await prisma.publicHoliday.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Holiday not found.' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const adminError = await requireDashboardAdmin(request);
  if (adminError) return adminError;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const recurring = Boolean(body.recurring);
  const date = parseDateInput(body.date);
  const recurDay =
    typeof body.recurDay === 'number' ? body.recurDay : parseInt(String(body.recurDay ?? ''), 10);
  const recurMonth =
    typeof body.recurMonth === 'number'
      ? body.recurMonth
      : parseInt(String(body.recurMonth ?? ''), 10);

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
    const updated = await prisma.publicHoliday.update({
      where: { id },
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
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[admin/holidays PUT]', error);
    return NextResponse.json({ error: 'Failed to update holiday.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const adminError = await requireDashboardAdmin(request);
  if (adminError) return adminError;
  const { id } = await context.params;
  try {
    await prisma.publicHoliday.update({ where: { id }, data: { isActive: false } });
    clearHolidayCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/holidays DELETE]', error);
    return NextResponse.json({ error: 'Failed to deactivate holiday.' }, { status: 500 });
  }
}
