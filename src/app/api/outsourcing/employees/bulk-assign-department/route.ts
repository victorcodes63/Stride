import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as {
    employeeIds?: unknown;
    departmentId?: unknown;
    clientId?: unknown;
  };

  const employeeIds = Array.isArray(b.employeeIds)
    ? (b.employeeIds as unknown[]).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  const departmentId =
    typeof b.departmentId === 'string' && b.departmentId.trim().length > 0 ? b.departmentId.trim() : null;
  const requestedClientId = typeof b.clientId === 'string' && b.clientId.trim().length > 0 ? b.clientId.trim() : null;
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: 'employeeIds must be a non-empty array.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, outsourcingClientId: true },
      });
      if (!dept) return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
      if (dept.outsourcingClientId !== clientId) {
        return NextResponse.json({ error: 'Department does not belong to this client.' }, { status: 400 });
      }
    }

    const result = await prisma.employee.updateMany({
      where: {
        id: { in: employeeIds },
        outsourcingClientId: clientId,
      },
      data: {
        departmentId,
      },
    });

    return NextResponse.json({
      updated: result.count,
      requested: employeeIds.length,
      skipped: Math.max(0, employeeIds.length - result.count),
    });
  } catch (e) {
    console.error('[employees/bulk-assign-department] error:', e);
    return NextResponse.json({ error: 'Failed to assign departments.' }, { status: 500 });
  }
}

