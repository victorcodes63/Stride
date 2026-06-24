import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser, isAdmin } from '@/lib/staff-api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.daysPerYear != null) data.daysPerYear = Math.max(0, parseInt(String(body.daysPerYear), 10) || 0);
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.color !== undefined) data.color = body.color ? String(body.color).trim() : null;
  if (body.requiresApproval !== undefined) data.requiresApproval = Boolean(body.requiresApproval);
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.sortOrder != null) data.sortOrder = parseInt(String(body.sortOrder), 10) || 0;
  const updated = await prisma.staffLeaveType.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id } = await params;
  await prisma.staffLeaveType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
