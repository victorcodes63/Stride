import type { Prisma } from '@prisma/client';
import type { TenantContext } from '@/lib/tenant-api';

export type ProcurementAuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  route?: string | null;
  meta?: unknown;
};

/**
 * Write an `AuditEvent` for a procurement action inside the caller's transaction, so the audit
 * row commits atomically with the mutation. Mirrors the audit payload written by
 * `withTenant`/`withTenantAudit` and the ESS procurement route, using the tenant context's actor.
 */
export async function recordProcurementAudit(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  input: ProcurementAuditInput,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      organizationId: ctx.organizationId,
      actorUserId: ctx.staff.id,
      actorEmail: ctx.staff.email,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      route: input.route ?? null,
      metadata: input.meta == null ? undefined : (input.meta as Prisma.InputJsonValue),
    },
  });
}
