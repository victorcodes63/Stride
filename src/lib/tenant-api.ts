import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { withOrgContext } from '@/lib/org-context';
import { requireStaffUser, type StaffUser } from '@/lib/staff-api-auth';
import { can, TenantForbiddenError } from '@/lib/rbac/can';
import { unauthorizedResponse, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';

export type TenantAuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  route?: string | null;
  metadata?: unknown;
};

export type TenantContext = {
  request: NextRequest;
  staff: StaffUser;
  organizationId: string;
  /** Run DB work with Postgres RLS context (app.current_org) set. */
  run: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
  /** Shorthand for tenant-scoped where filters (defense in depth when RLS bypassed). */
  where: <T extends Record<string, unknown>>(extra?: T) => T & { organizationId: string };
  audit: (input: TenantAuditInput) => Promise<void>;
};

export type WithTenantOptions = {
  permission?: string;
  adminOnly?: boolean;
};

export async function withTenant(
  request: NextRequest,
  handler: (ctx: TenantContext) => Promise<NextResponse>,
  options?: WithTenantOptions,
): Promise<NextResponse> {
  try {
    const staff = await requireStaffUser(request);
    if (!staff) return unauthorizedResponse();

    if (options?.adminOnly && staff.role !== 'admin') {
      return forbiddenResponse('Admin access required.');
    }

    if (options?.permission) {
      const allowed = await can(staff, options.permission);
      if (!allowed) {
        return forbiddenResponse(`Missing permission: ${options.permission}`);
      }
    }

    const ctx = buildTenantContext(request, staff);
    return await handler(ctx);
  } catch (error) {
    return handleTenantError(request, error);
  }
}

export function buildTenantContext(request: NextRequest, staff: StaffUser): TenantContext {
  const organizationId = staff.currentOrgId;

  return {
    request,
    staff,
    organizationId,
    run: (fn) => withOrgContext(organizationId, fn),
    where: (extra) => ({ ...(extra ?? {}), organizationId }),
    audit: (input) =>
      withOrgContext(organizationId, async (tx) => {
        await tx.auditEvent.create({
          data: {
            organizationId,
            actorUserId: staff.id,
            actorEmail: staff.email,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId ?? null,
            route: input.route ?? null,
            metadata: input.metadata == null ? undefined : (input.metadata as Prisma.InputJsonValue),
          },
        });
      }),
  };
}

/** Run a mutation inside tenant context, then write an audit row in the same transaction. */
export async function withTenantAudit<T>(
  ctx: TenantContext,
  audit: TenantAuditInput & { entityIdFromResult?: (result: T) => string | null | undefined },
  mutation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return ctx.run(async (tx) => {
    const result = await mutation(tx);
    await tx.auditEvent.create({
      data: {
        organizationId: ctx.organizationId,
        actorUserId: ctx.staff.id,
        actorEmail: ctx.staff.email,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityIdFromResult?.(result) ?? audit.entityId ?? null,
        route: audit.route ?? null,
        metadata: audit.metadata == null ? undefined : (audit.metadata as Prisma.InputJsonValue),
      },
    });
    return result;
  });
}

export function handleTenantError(request: NextRequest, error: unknown): NextResponse {
  if (error instanceof TenantForbiddenError) {
    return forbiddenResponse(error.message);
  }
  const route = request.nextUrl?.pathname ?? 'unknown';
  void reportApiError({
    route,
    message: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json({ error: 'Request failed.' }, { status: 500 });
}
