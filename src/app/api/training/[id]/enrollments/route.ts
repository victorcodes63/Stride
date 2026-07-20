import { Prisma, type TrainingEnrollment } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';
import { mapEnrollment } from '@/lib/training/service';
import type { TrainingEnrollmentInput } from '@/lib/training/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    let body: TrainingEnrollmentInput;
    try {
      body = (await request.json()) as TrainingEnrollmentInput;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body.enrolleeName?.trim()) {
      return NextResponse.json({ error: 'Enrollee name is required.' }, { status: 400 });
    }

    try {
      const program = await ctx.run((tx) =>
        tx.trainingProgram.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const enrollment = await withTenantAudit<TrainingEnrollment>(
        ctx,
        {
          action: 'training.enrollment.created',
          entityType: 'TrainingEnrollment',
          route: 'POST /api/training/[id]/enrollments',
          entityIdFromResult: (e) => e.id,
          metadata: { programId: id },
        },
        (tx) =>
          tx.trainingEnrollment.create({
            data: {
              organizationId: ctx.organizationId,
              programId: id,
              enrolleeName: body.enrolleeName.trim(),
              employeeId: body.employeeId ?? null,
              userId: body.userId ?? null,
              status: (body.status || 'enrolled') as never,
              notes: body.notes?.trim() || null,
            },
          }),
      );

      return NextResponse.json({ enrollment: mapEnrollment(enrollment) }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Already enrolled' }, { status: 409 });
      }
      await reportApiError({
        route: 'POST /api/training/[id]/enrollments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create enrollment.' }, { status: 500 });
    }
  });
}
