import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([], { status: 200 });
    }
    const departments = await prisma.department.findMany({
      where: { outsourcingClientId: clientId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
    return NextResponse.json(
      departments.map((d) => ({
        id: d.id,
        name: d.name,
        employeeCount: d._count.employees,
      }))
    );
  } catch (e) {
    console.error('[departments GET]', e);
    return NextResponse.json({ error: 'Failed to load departments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = typeof (body as { name?: string }).name === 'string'
    ? (body as { name: string }).name.trim()
    : '';
  if (!name) {
    return NextResponse.json({ error: 'Department name is required.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const department = await prisma.department.create({
      data: { outsourcingClientId: clientId, name },
      include: { _count: { select: { employees: true } } },
    });
    return NextResponse.json({
      id: department.id,
      name: department.name,
      employeeCount: department._count.employees,
    });
  } catch (e) {
    console.error('[departments POST]', e);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}
