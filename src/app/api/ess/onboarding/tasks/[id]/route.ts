import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    const status = (body as { status?: string }).status;
    if (status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Only marking complete is supported.' }, { status: 400 });
    }

    const task = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: {
          id,
          ...ctx.where(),
          workflow: { employeeId: ctx.employeeId! },
        },
      }),
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });

    const updated = await ctx.run((tx) =>
      tx.onboardingTask.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes:
            typeof (body as { notes?: string }).notes === 'string'
              ? (body as { notes: string }).notes
              : task.notes,
        },
      }),
    );

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt?.toISOString() ?? null,
    });
  });
}
