import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canWriteRota } from '@/lib/rota/api-auth';

type P = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const t = await prisma.shiftTemplate.findUnique({ where: { id } });
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(t);
}

export async function PATCH(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { id } = await params;
  const existing = await prisma.shiftTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: {
    name?: string;
    startMinutes?: number;
    endMinutes?: number;
    breakMinutes?: number;
    color?: string | null;
    isActive?: boolean;
  } = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.startMinutes != null) {
    const n = parseInt(String(body.startMinutes), 10);
    if (!Number.isFinite(n) || n < 0 || n > 1440) {
      return NextResponse.json({ error: 'Invalid startMinutes' }, { status: 400 });
    }
    data.startMinutes = n;
  }
  if (body.endMinutes != null) {
    const n = parseInt(String(body.endMinutes), 10);
    if (!Number.isFinite(n) || n < 0 || n > 1440) {
      return NextResponse.json({ error: 'Invalid endMinutes' }, { status: 400 });
    }
    data.endMinutes = n;
  }
  if (body.breakMinutes != null) {
    const n = parseInt(String(body.breakMinutes), 10);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Invalid breakMinutes' }, { status: 400 });
    data.breakMinutes = n;
  }
  if (body.color !== undefined) data.color = body.color == null ? null : String(body.color).trim() || null;
  if (body.isActive === true || body.isActive === false) data.isActive = body.isActive;

  const t = await prisma.shiftTemplate.update({ where: { id }, data });
  return NextResponse.json(t);
}

export async function DELETE(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { id } = await params;
  const existing = await prisma.shiftTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.shiftTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
