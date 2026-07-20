import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';
import { mapProgramDetail } from '@/lib/training/service';
import type { TrainingProgramInput } from '@/lib/training/types';

export const dynamic = 'force-dynamic';

const DETAIL_INCLUDE = {
  enrollments: { orderBy: { enrolledAt: 'desc' } },
  materials: { orderBy: { sortOrder: 'asc' } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const program = await ctx.run((tx) =>
        tx.trainingProgram.findFirst({
          where: ctx.where({ id }),
          include: DETAIL_INCLUDE,
        }),
      );
      if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ program: mapProgramDetail(program) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/training/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load training program.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    let body: TrainingProgramInput;
    try {
      body = (await request.json()) as TrainingProgramInput;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (body.title !== undefined && !body.title?.trim()) {
      return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 });
    }

    try {
      const existing = await ctx.run((tx) =>
        tx.trainingProgram.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const data: Record<string, unknown> = {};
      if (body.title !== undefined) data.title = body.title.trim();
      if (body.description !== undefined) data.description = body.description?.trim() || null;
      if (body.category !== undefined) data.category = body.category?.trim() || null;
      if (body.provider !== undefined) data.provider = body.provider?.trim() || null;
      if (body.location !== undefined) data.location = body.location?.trim() || null;
      if (body.isOnline !== undefined) data.isOnline = Boolean(body.isOnline);
      if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
      if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
      if (body.durationHours !== undefined) data.durationHours = body.durationHours != null ? Number(body.durationHours) : null;
      if (body.maxParticipants !== undefined) data.maxParticipants = body.maxParticipants != null ? Number(body.maxParticipants) : null;
      if (body.cost !== undefined) data.cost = body.cost != null ? Number(body.cost) : null;
      if (body.currency !== undefined) data.currency = body.currency || 'KES';
      if (body.status !== undefined) data.status = body.status as never;
      if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

      await withTenantAudit(
        ctx,
        {
          action: 'training.program.updated',
          entityType: 'TrainingProgram',
          entityId: id,
          route: 'PATCH /api/training/[id]',
        },
        (tx) => tx.trainingProgram.update({ where: { id }, data }),
      );

      const program = await ctx.run((tx) =>
        tx.trainingProgram.findFirst({ where: ctx.where({ id }), include: DETAIL_INCLUDE }),
      );
      if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ program: mapProgramDetail(program) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/training/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update training program.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.trainingProgram.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await withTenantAudit(
        ctx,
        {
          action: 'training.program.deleted',
          entityType: 'TrainingProgram',
          entityId: id,
          route: 'DELETE /api/training/[id]',
        },
        (tx) => tx.trainingProgram.delete({ where: { id } }),
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/training/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete training program.' }, { status: 500 });
    }
  });
}
