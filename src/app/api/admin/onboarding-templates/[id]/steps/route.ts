import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.title || !body?.assignedRole) {
    return NextResponse.json({ error: 'title and assignedRole are required' }, { status: 400 });
  }

  const step = await prisma.onboardingTemplateStep.create({
    data: {
      templateId: id,
      title: String(body.title),
      description: typeof body.description === 'string' ? body.description : null,
      assignedRole: String(body.assignedRole),
      order: Number(body.order ?? 1),
      dueDaysOffset: Number(body.dueDaysOffset ?? 3),
      isRequired: body.isRequired === undefined ? true : Boolean(body.isRequired),
      category: typeof body.category === 'string' ? body.category : null,
    },
  });
  return NextResponse.json(step, { status: 201 });
}
