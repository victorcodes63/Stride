import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser, type StaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export type FleetTenantContext = {
  request: NextRequest;
  staff: StaffUser;
  organizationId: string;
  workspaceClientId: string;
};

/** Standard tenant scope for fleet reads/writes — always include org + workspace client. */
export function fleetTenantWhere(
  ctx: Pick<FleetTenantContext, 'organizationId' | 'workspaceClientId'>,
  extra: Record<string, unknown> = {},
) {
  return {
    organizationId: ctx.organizationId,
    outsourcingClientId: ctx.workspaceClientId,
    ...extra,
  };
}

export async function withFleetTenant(
  request: NextRequest,
  handler: (ctx: FleetTenantContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const staff = await requireStaffUser(request);
  if (!staff) return unauthorizedResponse();
  if (!canAccessFleet(staff)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(
    prisma,
    null,
    request,
    staff.currentOrgId,
  );

  return handler({
    request,
    staff,
    organizationId: staff.currentOrgId,
    workspaceClientId,
  });
}
