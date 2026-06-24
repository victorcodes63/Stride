import { NextRequest, NextResponse } from 'next/server';
import { WorkflowType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';

export async function GET(request: NextRequest) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const templates = await prisma.onboardingTemplate.findMany({
    include: { _count: { select: { steps: true, workflows: true } } },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name || !body?.type) return NextResponse.json({ error: 'name and type are required' }, { status: 400 });

  const template = await prisma.onboardingTemplate.create({
    data: {
      name: String(body.name),
      type: String(body.type) as WorkflowType,
      isDefault: Boolean(body.isDefault),
    },
  });
  return NextResponse.json(template, { status: 201 });
}
