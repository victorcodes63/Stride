import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const { stepId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const step = await prisma.onboardingTemplateStep.update({
    where: { id: stepId },
    data: {
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      assignedRole: typeof body.assignedRole === 'string' ? body.assignedRole : undefined,
      order: typeof body.order === 'number' ? body.order : undefined,
      dueDaysOffset: typeof body.dueDaysOffset === 'number' ? body.dueDaysOffset : undefined,
      isRequired: typeof body.isRequired === 'boolean' ? body.isRequired : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
    },
  });
  return NextResponse.json(step);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const { stepId } = await params;
  await prisma.onboardingTemplateStep.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
