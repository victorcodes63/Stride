import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withEssTenant(request, async (ctx) => {
    const { id } = await params;
    const leave = await ctx.run((tx) =>
      tx.leaveApplication.findFirst({
        where: ctx.where({ id }),
        include: { employee: { select: { managerEmployeeId: true } } },
      }),
    );
    if (!leave) return NextResponse.json({ error: 'Leave application not found.' }, { status: 404 });

    const canView =
      (ctx.employeeId && leave.employeeId === ctx.employeeId) ||
      ctx.essUser.role === 'hr' ||
      (ctx.essUser.role === 'manager' && ctx.employeeId && leave.employee.managerEmployeeId === ctx.employeeId);
    if (!canView) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const actionFilter = searchParams.get('action');
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 10)));

    const whereAction =
      actionFilter === 'requested' || actionFilter === 'approved' || actionFilter === 'rejected'
        ? `ess.leave.${actionFilter}`
        : undefined;

    const whereBase = ctx.where({
      entityType: 'LeaveApplication' as const,
      entityId: id,
      action: whereAction ? whereAction : ({ startsWith: 'ess.leave.' } as const),
    });

    const { total, events } = await ctx.run(async (tx) => {
      const count = await tx.auditEvent.count({ where: whereBase });
      const rows = await tx.auditEvent.findMany({
        where: whereBase,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          actorEmail: true,
          metadata: true,
          createdAt: true,
        },
      });
      return { total: count, events: rows };
    });

    const filtered = events.filter((event) => {
      if (!q) return true;
      const note =
        typeof (event.metadata as { note?: unknown } | null)?.note === 'string'
          ? (((event.metadata as { note?: string } | null)?.note) ?? '')
          : '';
      return (
        (event.actorEmail || '').toLowerCase().includes(q) ||
        event.action.toLowerCase().includes(q) ||
        note.toLowerCase().includes(q)
      );
    });

    return NextResponse.json({
      items: filtered.map((event) => ({
        id: event.id,
        action: event.action,
        actorEmail: event.actorEmail,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
