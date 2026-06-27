import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
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
    const requestedClientId =
      typeof b.clientId === 'string' && b.clientId.trim().length > 0 ? b.clientId.trim() : null;
    if (employeeIds.length === 0) {
      return NextResponse.json({ error: 'employeeIds must be a non-empty array.' }, { status: 400 });
    }

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          requestedClientId,
          request,
          ctx.organizationId,
        );

        if (departmentId) {
          const dept = await tx.department.findFirst({
            where: ctx.where({ id: departmentId, outsourcingClientId: clientId }),
            select: { id: true },
          });
          if (!dept) return { error: 'department' as const };
        }

        return tx.employee.updateMany({
          where: ctx.where({
            id: { in: employeeIds },
            outsourcingClientId: clientId,
          }),
          data: { departmentId },
        });
      });

      if ('error' in result) {
        return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
      }

      return NextResponse.json({
        updated: result.count,
        requested: employeeIds.length,
        skipped: Math.max(0, employeeIds.length - result.count),
      });
    } catch (e) {
      console.error('[employees/bulk-assign-department] error:', e);
      return NextResponse.json({ error: 'Failed to assign departments.' }, { status: 500 });
    }
  });
}
