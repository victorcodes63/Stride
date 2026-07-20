import { NextRequest, NextResponse } from 'next/server';
import { RotaPeriodStatus } from '@prisma/client';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import { withTenant } from '@/lib/tenant-api';

type P = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const p = await ctx.run((tx) =>
      tx.staffRotaPeriod.findFirst({
        where: ctx.where({ id }),
        include: { _count: { select: { assignments: true } } },
      }),
    );
    if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(p);
  });
}

export async function PATCH(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    if (!canManageStaffRota(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;
    const existing = await ctx.run((tx) => tx.staffRotaPeriod.findFirst({ where: ctx.where({ id }) }));
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: { name?: string | null; startDate?: Date; endDate?: Date; status?: RotaPeriodStatus } = {};
    if (body.name !== undefined) data.name = body.name == null ? null : String(body.name).trim() || null;
    if (body.startDate != null) {
      const s = String(body.startDate).trim();
      const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
      data.startDate = d;
    }
    if (body.endDate != null) {
      const s = String(body.endDate).trim();
      const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
      data.endDate = d;
    }
    if (body.status === 'published' || body.status === 'draft') {
      data.status = body.status === 'published' ? RotaPeriodStatus.published : RotaPeriodStatus.draft;
    }

    const nextStart = data.startDate ?? existing.startDate;
    const nextEnd = data.endDate ?? existing.endDate;
    if (nextEnd < nextStart) {
      return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
    }

    const updated = await ctx.run((tx) => tx.staffRotaPeriod.update({ where: { id }, data }));

    // Publish diff + audit trail: capture the roster snapshot at publish time.
    if (data.status && data.status !== existing.status) {
      const transition = `${existing.status}->${data.status}`;
      let assignmentCount = 0;
      let staffCount = 0;
      if (data.status === RotaPeriodStatus.published) {
        const rows = await ctx.run((tx) =>
          tx.staffShiftAssignment.findMany({
            where: ctx.where({ staffRotaPeriodId: id }),
            select: { userId: true },
          }),
        );
        assignmentCount = rows.length;
        staffCount = new Set(rows.map((r) => r.userId)).size;
      }
      await ctx.audit({
        action: data.status === RotaPeriodStatus.published ? 'staff_rota.period.publish' : 'staff_rota.period.unpublish',
        entityType: 'StaffRotaPeriod',
        entityId: id,
        route: request.nextUrl.pathname,
        metadata: { transition, assignmentCount, staffCount, name: updated.name },
      });
    } else {
      await ctx.audit({
        action: 'staff_rota.period.update',
        entityType: 'StaffRotaPeriod',
        entityId: id,
        route: request.nextUrl.pathname,
        metadata: data,
      });
    }

    return NextResponse.json(updated);
  });
}

export async function DELETE(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    if (!canManageStaffRota(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;
    const existing = await ctx.run((tx) => tx.staffRotaPeriod.findFirst({ where: ctx.where({ id }) }));
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === RotaPeriodStatus.published) {
      return NextResponse.json(
        { error: 'Unpublish the period before deleting it' },
        { status: 409 },
      );
    }
    await ctx.run((tx) => tx.staffRotaPeriod.delete({ where: { id } }));
    await ctx.audit({
      action: 'staff_rota.period.delete',
      entityType: 'StaffRotaPeriod',
      entityId: id,
      route: request.nextUrl.pathname,
      metadata: { name: existing.name },
    });
    return NextResponse.json({ ok: true });
  });
}
