import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';
import { mapEnrollment } from '@/lib/training/service';
import type { TrainingEnrollmentUpdate } from '@/lib/training/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, enrollmentId } = await params;
    let body: TrainingEnrollmentUpdate;
    try {
      body = (await request.json()) as TrainingEnrollmentUpdate;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const existing = await ctx.run((tx) =>
        tx.trainingEnrollment.findFirst({
          where: ctx.where({ id: enrollmentId, programId: id }),
          select: { id: true },
        }),
      );
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const data: Record<string, unknown> = {};
      if (body.status !== undefined) data.status = body.status as never;
      if (body.score !== undefined) data.score = body.score != null ? Number(body.score) : null;
      if (body.feedback !== undefined) data.feedback = body.feedback?.trim() || null;
      if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
      if (body.completedAt !== undefined) {
        data.completedAt = body.completedAt ? new Date(body.completedAt) : null;
      } else if (body.status === 'completed') {
        data.completedAt = new Date();
      } else if (body.status !== undefined) {
        data.completedAt = null;
      }

      const enrollment = await withTenantAudit(
        ctx,
        {
          action: 'training.enrollment.updated',
          entityType: 'TrainingEnrollment',
          entityId: enrollmentId,
          route: 'PATCH /api/training/[id]/enrollments/[enrollmentId]',
          metadata: { programId: id },
        },
        (tx) => tx.trainingEnrollment.update({ where: { id: enrollmentId }, data }),
      );

      return NextResponse.json({ enrollment: mapEnrollment(enrollment) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/training/[id]/enrollments/[enrollmentId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update enrollment.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, enrollmentId } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.trainingEnrollment.findFirst({
          where: ctx.where({ id: enrollmentId, programId: id }),
          select: { id: true },
        }),
      );
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await withTenantAudit(
        ctx,
        {
          action: 'training.enrollment.deleted',
          entityType: 'TrainingEnrollment',
          entityId: enrollmentId,
          route: 'DELETE /api/training/[id]/enrollments/[enrollmentId]',
          metadata: { programId: id },
        },
        (tx) => tx.trainingEnrollment.delete({ where: { id: enrollmentId } }),
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/training/[id]/enrollments/[enrollmentId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete enrollment.' }, { status: 500 });
    }
  });
}
