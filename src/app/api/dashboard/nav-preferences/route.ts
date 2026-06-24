import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';
import {
  getAllowedDashboardNavHrefs,
  getUserPinnedNavHrefs,
  parsePinnedNavHrefs,
  sanitizePinnedNavHrefs,
  setUserPinnedNavHrefs,
} from '@/lib/dashboard-nav-preferences';
import type { StaffUserType, UserRole } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

async function loadUserContext(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, staffUserType: true },
  });
}

/** GET — pinned dashboard nav items for the signed-in user. */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const ctx = await loadUserContext(user.id);
    if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const [stored, allowed] = await Promise.all([
      getUserPinnedNavHrefs(user.id),
      getAllowedDashboardNavHrefs({
        id: user.id,
        role: ctx.role as UserRole,
        staffUserType: ctx.staffUserType as StaffUserType,
      }),
    ]);

    const pinned = sanitizePinnedNavHrefs(stored, allowed);
    if (pinned.length !== stored.length) {
      await setUserPinnedNavHrefs(user.id, pinned);
    }

    return NextResponse.json({ pinned });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/dashboard/nav-preferences',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load navigation preferences' }, { status: 500 });
  }
}

/** PATCH — update pinned dashboard nav items (ordered href list). */
export async function PATCH(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const requested = parsePinnedNavHrefs(
    body && typeof body === 'object' && 'pinned' in body
      ? (body as { pinned: unknown }).pinned
      : null,
  );

  try {
    const ctx = await loadUserContext(user.id);
    if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const allowed = await getAllowedDashboardNavHrefs({
      id: user.id,
      role: ctx.role as UserRole,
      staffUserType: ctx.staffUserType as StaffUserType,
    });
    const pinned = sanitizePinnedNavHrefs(requested, allowed);
    await setUserPinnedNavHrefs(user.id, pinned);

    return NextResponse.json({ pinned });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/dashboard/nav-preferences',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to save navigation preferences' }, { status: 500 });
  }
}
