import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

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

  const task = await prisma.onboardingTask.findFirst({
    where: {
      id,
      workflow: { employeeId: user.employeeId },
    },
  });
  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });

  const updated = await prisma.onboardingTask.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      notes: typeof (body as { notes?: string }).notes === 'string' ? (body as { notes: string }).notes : task.notes,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    completedAt: updated.completedAt?.toISOString() ?? null,
  });
}
