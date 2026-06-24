import type { Prisma } from '@prisma/client';
import { Prisma as PrismaRuntime } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { resolveMembership } from '@/lib/org-membership';
import type { AdminActor } from '@/lib/admin-security';

type AuditInput = {
  actor: AdminActor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  route?: string | null;
  metadata?: unknown;
  organizationId?: string | null;
};

async function resolveAuditOrganizationId(input: AuditInput): Promise<string | null> {
  if (input.organizationId) return input.organizationId;
  if (input.actor?.organizationId) return input.actor.organizationId;
  if (input.actor?.userId) {
    const membership = await resolveMembership(input.actor.userId);
    return membership?.organizationId ?? null;
  }
  return null;
}

export async function logAuditEvent(input: AuditInput): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  const organizationId = await resolveAuditOrganizationId(input);
  if (!organizationId) {
    console.error('Failed to write audit event: missing organizationId', input.action);
    return;
  }

  try {
    await withOrgContext(organizationId, async (tx) => {
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorUserId: input.actor?.userId ?? null,
          actorEmail: input.actor?.email ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          route: input.route ?? null,
          metadata:
            input.metadata == null
              ? PrismaRuntime.JsonNull
              : (input.metadata as Prisma.InputJsonValue),
        },
      });
    });
  } catch (error) {
    console.error('Failed to write audit event:', error);
  }
}
