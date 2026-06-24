import { NextRequest, NextResponse } from 'next/server';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';
import {
  clearUserModuleOrder,
  parseModuleOrderIds,
  resolveUserModuleOrder,
  sanitizeModuleOrder,
  setUserModuleOrder,
} from '@/lib/dashboard-module-preferences';

export const dynamic = 'force-dynamic';

/** GET — module switcher order for the signed-in user. */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { moduleOrder, isCustom } = await resolveUserModuleOrder(user.id);
    return NextResponse.json({ moduleOrder, isCustom });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/dashboard/module-preferences',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load module preferences' }, { status: 500 });
  }
}

/** PATCH — save personal module order, or reset to role default. */
export async function PATCH(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reset =
    body && typeof body === 'object' && 'reset' in body && (body as { reset?: unknown }).reset === true;

  try {
    if (reset) {
      const moduleOrder = await clearUserModuleOrder(user.id);
      return NextResponse.json({ moduleOrder, isCustom: false });
    }

    const requested = parseModuleOrderIds(
      body && typeof body === 'object' && 'moduleOrder' in body
        ? (body as { moduleOrder: unknown }).moduleOrder
        : null,
    );
    const moduleOrder = await setUserModuleOrder(user.id, sanitizeModuleOrder(requested));
    return NextResponse.json({ moduleOrder, isCustom: true });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/dashboard/module-preferences',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to save module preferences' }, { status: 500 });
  }
}
