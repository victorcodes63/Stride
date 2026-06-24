import { NextRequest, NextResponse } from 'next/server';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';
import {
  clearUserDashboardOverviewLayout,
  getUserDashboardOverviewLayout,
  isLayoutCustomized,
  parseDashboardOverviewLayout,
  setUserDashboardOverviewLayout,
} from '@/lib/dashboard-overview-preferences';

export const dynamic = 'force-dynamic';

/** GET — dashboard home layout preferences for the signed-in user. */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const layout = await getUserDashboardOverviewLayout(user.id);
    return NextResponse.json({ layout, isCustom: isLayoutCustomized(layout) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/dashboard/overview-preferences',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load dashboard layout preferences' }, { status: 500 });
  }
}

/** PATCH — save or reset dashboard home layout preferences. */
export async function PATCH(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (body && typeof body === 'object' && 'reset' in body && (body as { reset: unknown }).reset === true) {
      const layout = await clearUserDashboardOverviewLayout(user.id);
      return NextResponse.json({ layout, isCustom: false });
    }

    const requested = parseDashboardOverviewLayout(
      body && typeof body === 'object' && 'layout' in body ? (body as { layout: unknown }).layout : body,
    );
    const layout = await setUserDashboardOverviewLayout(user.id, requested);
    return NextResponse.json({ layout, isCustom: isLayoutCustomized(layout) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/dashboard/overview-preferences',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to save dashboard layout preferences' }, { status: 500 });
  }
}
