import type { Prisma } from '@prisma/client';
import { Prisma as PrismaRuntime } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AdminActor } from '@/lib/admin-security';

type AuditInput = {
  actor: AdminActor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  route?: string | null;
  metadata?: unknown;
};

export async function logAuditEvent(input: AuditInput): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.auditEvent.create({
      data: {
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
  } catch (error) {
    console.error('Failed to write audit event:', error);
  }
}
