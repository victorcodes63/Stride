import { describe, expect, it } from 'vitest';
import { detectDependencyCycle, type DependencyEdge } from '@/lib/projects/dependencies';

describe('detectDependencyCycle', () => {
  it('flags self-dependencies', () => {
    expect(detectDependencyCycle([], 'a', 'a')).toBe(true);
  });

  it('allows a new independent edge', () => {
    expect(detectDependencyCycle([], 'a', 'b')).toBe(false);
  });

  it('detects a direct 2-node cycle', () => {
    const edges: DependencyEdge[] = [{ blockingTaskId: 'b', blockedTaskId: 'a' }];
    // b blocks a already; adding a blocks b closes the loop.
    expect(detectDependencyCycle(edges, 'a', 'b')).toBe(true);
  });

  it('detects a transitive cycle across a chain', () => {
    const edges: DependencyEdge[] = [
      { blockingTaskId: 'b', blockedTaskId: 'c' },
      { blockingTaskId: 'c', blockedTaskId: 'a' },
    ];
    // b -> c -> a already; adding a -> b would create a -> b -> c -> a.
    expect(detectDependencyCycle(edges, 'a', 'b')).toBe(true);
  });

  it('allows a diamond (no cycle)', () => {
    const edges: DependencyEdge[] = [
      { blockingTaskId: 'a', blockedTaskId: 'b' },
      { blockingTaskId: 'a', blockedTaskId: 'c' },
    ];
    // Adding b -> d and c -> d is fine.
    expect(detectDependencyCycle(edges, 'b', 'd')).toBe(false);
    expect(detectDependencyCycle(edges, 'c', 'd')).toBe(false);
  });

  it('does not loop forever on pre-existing cycles in data', () => {
    const edges: DependencyEdge[] = [
      { blockingTaskId: 'x', blockedTaskId: 'y' },
      { blockingTaskId: 'y', blockedTaskId: 'x' },
    ];
    expect(detectDependencyCycle(edges, 'z', 'x')).toBe(false);
  });
});
