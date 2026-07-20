import type { Prisma } from '@prisma/client';

/**
 * Fetch a task scoped to the caller's organization + resolved workspace client.
 * Returns a minimal projection (id + projectId) or null when the task is not
 * visible to this tenant. Callers should return 404 on null (never leak).
 */
export function findScopedTask(
  tx: Prisma.TransactionClient,
  params: { taskId: string; organizationId: string; outsourcingClientId: string },
) {
  return tx.projectTask.findFirst({
    where: {
      id: params.taskId,
      organizationId: params.organizationId,
      project: { outsourcingClientId: params.outsourcingClientId },
    },
    select: { id: true, projectId: true, title: true },
  });
}

/**
 * Fetch a project scoped to the caller's organization + resolved workspace client.
 * Returns a minimal projection or null when not visible to this tenant.
 */
export function findScopedProject(
  tx: Prisma.TransactionClient,
  params: { projectId: string; organizationId: string; outsourcingClientId: string },
) {
  return tx.project.findFirst({
    where: {
      id: params.projectId,
      organizationId: params.organizationId,
      outsourcingClientId: params.outsourcingClientId,
    },
    select: { id: true, name: true },
  });
}

/** Extract unique, non-empty string mentions from a JSON body field. */
export function normalizeMentionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((m): m is string => typeof m === 'string' && m.trim().length > 0))];
}

/**
 * Restrict a set of candidate mention ids to real, active members of the org
 * (excluding the author). Defends against spoofed/foreign user ids driving
 * notifications.
 */
export async function filterValidMentions(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; candidateIds: string[]; excludeUserId: string },
): Promise<string[]> {
  if (params.candidateIds.length === 0) return [];
  const members = await tx.organizationMembership.findMany({
    where: { organizationId: params.organizationId, status: 'active', userId: { in: params.candidateIds } },
    select: { userId: true },
  });
  const valid = new Set(members.map((m) => m.userId));
  return params.candidateIds.filter((id) => valid.has(id) && id !== params.excludeUserId);
}
