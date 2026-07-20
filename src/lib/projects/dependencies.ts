/**
 * Pure helpers for task dependency graph reasoning.
 *
 * A dependency edge is directed: `blockingTaskId` blocks `blockedTaskId`
 * (i.e. the blocked task cannot start/finish until the blocking task is done).
 */
export type DependencyEdge = {
  blockingTaskId: string;
  blockedTaskId: string;
};

/**
 * Returns true if adding an edge (blockingTaskId -> blockedTaskId) to the
 * existing set of edges would create a cycle.
 *
 * A cycle is introduced when the task we want to block can already reach the
 * blocking task by following existing edges (or when both ids are equal).
 */
export function detectDependencyCycle(
  edges: DependencyEdge[],
  blockingTaskId: string,
  blockedTaskId: string,
): boolean {
  if (blockingTaskId === blockedTaskId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.blockingTaskId);
    if (list) {
      list.push(edge.blockedTaskId);
    } else {
      adjacency.set(edge.blockingTaskId, [edge.blockedTaskId]);
    }
  }

  // Walk forward from blockedTaskId; if we can reach blockingTaskId, the new
  // edge would close a loop.
  const stack: string[] = [blockedTaskId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === blockingTaskId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const next = adjacency.get(node);
    if (next) stack.push(...next);
  }

  return false;
}
