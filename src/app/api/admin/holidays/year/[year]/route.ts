import { NextRequest, NextResponse } from 'next/server';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getHolidaysForYear } from '@/lib/holidays';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ year: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { year: yearParam } = await context.params;
  const year = parseInt(yearParam, 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year parameter.' }, { status: 400 });
  }
  try {
    const holidays = await getHolidaysForYear(year, user.currentOrgId);
    return NextResponse.json(holidays);
  } catch (error) {
    console.error('[admin/holidays/year GET]', error);
    return NextResponse.json({ error: 'Failed to load holidays.' }, { status: 500 });
  }
}
