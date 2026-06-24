import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; departmentId: string }> }
) {
  const { id: clientId, departmentId: id } = await params;
  if (!clientId || !id) return NextResponse.json({ error: 'Client and department id required' }, { status: 400 });

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
    const department = await prisma.department.updateMany({
      where: { id, outsourcingClientId: clientId },
      data: { name },
    });
    if (department.count === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }
    const updated = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    return NextResponse.json({
      id: updated!.id,
      name: updated!.name,
      employeeCount: updated!._count.employees,
    });
  } catch (e) {
    console.error('[departments PATCH]', e);
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; departmentId: string }> }
) {
  const { id: clientId, departmentId: id } = await params;
  if (!clientId || !id) return NextResponse.json({ error: 'Client and department id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const result = await prisma.department.deleteMany({
      where: { id, outsourcingClientId: clientId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[departments DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
  }
}
