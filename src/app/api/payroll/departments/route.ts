import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

/**
 * Departments for the company's own workforce (primary workspace client).
 * Payroll-module scoped so internal payroll never depends on the HR Outsourcing module.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([], { status: 200 });
    }

    const clientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const departments = await ctx.run((tx) =>
      tx.department.findMany({
        where: {
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        },
        orderBy: { name: 'asc' },
        include: { _count: { select: { employees: true } } },
      }),
    );

    return NextResponse.json(
      departments.map((d) => ({
        id: d.id,
        name: d.name,
        employeeCount: d._count.employees,
      })),
    );
  });
}
