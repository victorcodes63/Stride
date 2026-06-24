import { NextRequest, NextResponse } from 'next/server';
import { WorkflowType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const { id } = await params;
  const template = await prisma.onboardingTemplate.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const updated = await prisma.onboardingTemplate.update({
    where: { id },
    data: {
      name: typeof body.name === 'string' ? body.name : undefined,
      type: typeof body.type === 'string' ? (body.type as WorkflowType) : undefined,
      isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminActor(request);
  if (error) return error;
  const { id } = await params;
  await prisma.onboardingTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
