import type { Prisma, ProjectActivityType } from '@prisma/client';

export type LogProjectActivityInput = {
  organizationId: string;
  projectId: string;
  taskId?: string | null;
  type: ProjectActivityType;
  actorUserId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue | null;
};

/**
 * Insert a `ProjectActivity` row. Call this inside the same `ctx.run`/transaction
 * as the mutation it describes so the audit trail is atomic with the change.
 */
export function logProjectActivity(
  tx: Prisma.TransactionClient,
  input: LogProjectActivityInput,
) {
  return tx.projectActivity.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      type: input.type,
      actorUserId: input.actorUserId ?? null,
      summary: input.summary,
      metadata: input.metadata == null ? undefined : input.metadata,
    },
  });
}
