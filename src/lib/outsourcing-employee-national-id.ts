/** Normalize national ID for storage and duplicate checks (trim, lowercase; empty → null). */
export function normalizeEmployeeNationalId(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}
