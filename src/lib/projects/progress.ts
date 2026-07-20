/**
 * Clamp an arbitrary progress input to an integer percentage in [0, 100].
 * Returns 0 for non-finite input.
 */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Parse a loosely-typed progress value (from a JSON body) into a clamped
 * integer percentage, or `undefined` when the value is not a usable number.
 * Useful for PATCH handlers where absent/invalid fields should be ignored.
 */
export function parseProgress(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return clampProgress(value);
}
