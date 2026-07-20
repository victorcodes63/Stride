import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';
import { listOrgStaffUserIds } from '@/lib/staff-time-attendance/staff-directory';
import { serializeStaffException } from '@/lib/staff-time-attendance/attendance-serialize';

const USER_SELECT = { select: { id: true, name: true, email: true, department: true } } as const;

/**
 * GET /api/staff/attendance/exceptions
 * Exceptions inbox — defaults to open exceptions; pass ?status=all to include
 * resolved/ignored.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const status = request.nextUrl.searchParams.get('status')?.trim() || 'open';

    const exceptions = await ctx.run(async (tx) => {
      const staffIds = await listOrgStaffUserIds(tx, ctx.organizationId);
      if (staffIds.length === 0) return [];
      return tx.staffAttendanceException.findMany({
        where: ctx.where({
          userId: { in: staffIds },
          ...(status && status !== 'all' ? { status } : {}),
        }) as unknown as Prisma.StaffAttendanceExceptionWhereInput,
        include: { user: USER_SELECT, resolvedByUser: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { workDate: 'desc' }],
        take: 500,
      });
    });

    return NextResponse.json({
      exceptions: exceptions.map(serializeStaffException),
      canManage: staffUserCanManageAttendance(ctx.staff),
    });
  });
}

/**
 * PATCH /api/staff/attendance/exceptions
 * Resolve / ignore one or many exceptions (bulk-approve). Manage-permission
 * required. Body: { ids: string[]; action: 'resolve' | 'ignore'; resolutionNotes? }
 */
export async function PATCH(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to resolve exceptions.' }, { status: 403 });
    }

    let body: { ids?: unknown; id?: unknown; action?: unknown; resolutionNotes?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((v): v is string => typeof v === 'string')
      : typeof body.id === 'string'
        ? [body.id]
        : [];
    const action = body.action === 'ignore' ? 'ignored' : body.action === 'resolve' ? 'resolved' : null;
    const resolutionNotes = typeof body.resolutionNotes === 'string' ? body.resolutionNotes.trim() || null : null;

    if (ids.length === 0) return NextResponse.json({ error: 'ids required.' }, { status: 400 });
    if (!action) return NextResponse.json({ error: 'action must be resolve or ignore.' }, { status: 400 });

    const updated = await ctx.run(async (tx) => {
      const staffIds = await listOrgStaffUserIds(tx, ctx.organizationId);
      const result = await tx.staffAttendanceException.updateMany({
        where: ctx.where({ id: { in: ids }, userId: { in: staffIds } }),
        data: {
          status: action,
          resolvedByUserId: ctx.staff.id,
          resolvedAt: new Date(),
          resolutionNotes,
        },
      });
      return result.count;
    });

    await ctx.audit({
      action: `staff_attendance.exception.${action}`,
      entityType: 'StaffAttendanceException',
      entityId: ids[0] ?? null,
      route: 'PATCH /api/staff/attendance/exceptions',
      metadata: { ids, action, count: updated, resolutionNotes },
    });

    return NextResponse.json({ ok: true, count: updated });
  });
}
