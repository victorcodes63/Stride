import { NextRequest, NextResponse } from 'next/server';

import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { prisma } from '@/lib/prisma';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const cycles = await ctx.run((tx) =>
      tx.performanceCycle.findMany({
        where: ctx.where(),
        include: {
          _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    return NextResponse.json({
      cycles: cycles.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        periodStart: c.periodStart.toISOString().slice(0, 10),
        periodEnd: c.periodEnd.toISOString().slice(0, 10),
        status: c.status,
        outsourcingClientId: c.outsourcingClientId,
        activatedAt: c.activatedAt?.toISOString() ?? null,
        closedAt: c.closedAt?.toISOString() ?? null,
        reviewCount: c._count.reviews,
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      periodStart?: string;
      periodEnd?: string;
      clientId?: string;
    };

    const name = body.name?.trim();
    const periodStart = body.periodStart?.trim();
    const periodEnd = body.periodEnd?.trim();
    if (!name || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'name, periodStart, and periodEnd are required' },
        { status: 400 },
      );
    }

    const clientId = await resolvePrimaryWorkspaceClientId(prisma, body.clientId, request);

    const cycle = await ctx.run((tx) =>
      tx.performanceCycle.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          description: body.description?.trim() || null,
          periodStart: new Date(`${periodStart}T00:00:00.000Z`),
          periodEnd: new Date(`${periodEnd}T00:00:00.000Z`),
          outsourcingClientId: clientId,
          createdByUserId: ctx.staff.id,
          status: 'draft',
        },
      }),
    );

    await ctx.audit({
      action: 'performance.cycle.created',
      entityType: 'PerformanceCycle',
      entityId: cycle.id,
      route: 'POST /api/performance/cycles',
    });

    return NextResponse.json({ cycle }, { status: 201 });
  });
}
