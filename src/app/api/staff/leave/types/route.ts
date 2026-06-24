import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser, isAdmin } from '@/lib/staff-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = request.nextUrl.searchParams.get('all') === '1' && isAdmin(user);
  const types = await prisma.staffLeaveType.findMany({
    where: all ? {} : { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const daysPerYear = Math.max(0, parseInt(String(body.daysPerYear ?? 21), 10) || 21);
  const created = await prisma.staffLeaveType.create({
    data: {
      name,
      daysPerYear,
      description: body.description ? String(body.description).trim() || null : null,
      color: body.color ? String(body.color).trim() || null : null,
      requiresApproval: body.requiresApproval !== false,
      active: body.active !== false,
      sortOrder: parseInt(String(body.sortOrder ?? 0), 10) || 0,
    },
  });
  return NextResponse.json(created);
}
