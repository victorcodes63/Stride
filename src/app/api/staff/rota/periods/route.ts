import { NextRequest, NextResponse } from 'next/server';
import { RotaPeriodStatus } from '@prisma/client';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const list = await ctx.run((tx) =>
      tx.staffRotaPeriod.findMany({
        where: ctx.where(),
        orderBy: { startDate: 'desc' },
        take: 100,
        include: { _count: { select: { assignments: true } } },
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

    const name = body.name != null ? String(body.name).trim() || null : null;
    const startStr = String(body.startDate || '').trim();
    const endStr = String(body.endDate || '').trim();
    const startDate = new Date(startStr.length === 10 ? `${startStr}T00:00:00` : startStr);
    const endDate = new Date(endStr.length === 10 ? `${endStr}T00:00:00` : endStr);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'startDate and endDate are required (YYYY-MM-DD or ISO)' },
        { status: 400 },
      );
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
    }

    let status: RotaPeriodStatus = RotaPeriodStatus.draft;
    if (body.status === 'published') status = RotaPeriodStatus.published;

    const created = await ctx.run((tx) =>
      tx.staffRotaPeriod.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          startDate,
          endDate,
          status,
        },
      }),
    );

    await ctx.audit({
      action: 'staff_rota.period.create',
      entityType: 'StaffRotaPeriod',
      entityId: created.id,
      route: request.nextUrl.pathname,
      metadata: { name, startDate: startStr, endDate: endStr },
    });

    return NextResponse.json(created, { status: 201 });
  });
}
