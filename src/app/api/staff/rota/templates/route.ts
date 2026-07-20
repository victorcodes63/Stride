import { NextRequest, NextResponse } from 'next/server';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const includeInactive = request.nextUrl.searchParams.get('all') === '1';
    const list = await ctx.run((tx) =>
      tx.staffShiftTemplate.findMany({
        where: includeInactive ? ctx.where() : ctx.where({ isActive: true }),
        orderBy: { name: 'asc' },
      }),
    );
    return NextResponse.json(list);
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageStaffRota(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to manage the rota' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const name = String(body.name || '').trim();
    const startMinutes = parseInt(String(body.startMinutes), 10);
    const endMinutes = parseInt(String(body.endMinutes), 10);
    if (!name || !Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
      return NextResponse.json({ error: 'name, startMinutes, and endMinutes are required' }, { status: 400 });
    }
    if (startMinutes < 0 || startMinutes > 1440 || endMinutes < 0 || endMinutes > 1440) {
      return NextResponse.json(
        { error: 'startMinutes and endMinutes must be between 0 and 1440' },
        { status: 400 },
      );
    }
    const breakMinutes =
      body.breakMinutes != null ? Math.max(0, parseInt(String(body.breakMinutes), 10) || 0) : 0;
    const color = body.color != null ? String(body.color).trim() || null : null;
    const isActive = body.isActive === false ? false : true;

    const created = await ctx.run((tx) =>
      tx.staffShiftTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          startMinutes,
          endMinutes,
          breakMinutes,
          color,
          isActive,
        },
      }),
    );

    await ctx.audit({
      action: 'staff_rota.template.create',
      entityType: 'StaffShiftTemplate',
      entityId: created.id,
      route: request.nextUrl.pathname,
      metadata: { name, startMinutes, endMinutes, breakMinutes },
    });

    return NextResponse.json(created, { status: 201 });
  });
}
