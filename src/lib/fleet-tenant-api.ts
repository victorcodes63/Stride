import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { requireStaffUser, type StaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';

export type FleetTenantContext = {
  request: NextRequest;
  staff: StaffUser;
  organizationId: string;
  workspaceClientId: string;
  /**
   * Run DB work with Postgres RLS context (`app.current_org`) set.
   * Fleet tables use FORCE RLS — bare `prisma.*` calls outside this will fail or return empty.
   */
  run: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
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
  try {
    const staff = await requireStaffUser(request);
    if (!staff) return unauthorizedResponse();
    if (!canAccessFleet(staff)) {
      return forbiddenResponse('Fleet access is restricted to operations and admin users.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
    }

    const organizationId = staff.currentOrgId;
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      organizationId,
    );

    const ctx: FleetTenantContext = {
      request,
      staff,
      organizationId,
      workspaceClientId,
      run: (fn) => withOrgContext(organizationId, fn),
    };

    return await handler(ctx);
  } catch (error) {
    await reportApiError({
      route: request.nextUrl?.pathname ?? 'fleet',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fleet request failed.' },
      { status: 500 },
    );
  }
}
