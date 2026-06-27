import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const status = typeof (body as Record<string, unknown>).status === 'string'
      ? String((body as Record<string, unknown>).status).trim().toLowerCase()
      : '';
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'Status must be approved or rejected.' }, { status: 400 });
    }

    const { id } = await params;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, null, request, ctx.organizationId);

    const existing = await ctx.run((tx) =>
      tx.leaveApplication.findFirst({
        where: {
          id,
          ...ctx.where(),
          employee: { outsourcingClientId: clientId },
        },
      }),
    );
    if (!existing) {
      return NextResponse.json({ error: 'Leave application not found.' }, { status: 404 });
    }

    const updated = await withTenantAudit(
      ctx,
      {
        action: `leave.${status}`,
        entityType: 'LeaveApplication',
        entityId: id,
        route: 'PATCH /api/outsourcing/leave/applications/[id]',
      },
      async (tx) => {
        return tx.leaveApplication.update({
          where: { id },
          data: { status },
          include: {
            leaveType: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          },
        });
      },
    );

    return NextResponse.json({
      id: updated.id,
      employeeName: `${updated.employee.firstName} ${updated.employee.lastName}`.trim(),
      employeeNumber: updated.employee.employeeNumber,
      leaveTypeName: updated.leaveType.name,
      startDate: updated.startDate.toISOString().slice(0, 10),
      endDate: updated.endDate.toISOString().slice(0, 10),
      days: updated.days,
      status: updated.status,
    });
  });
}
