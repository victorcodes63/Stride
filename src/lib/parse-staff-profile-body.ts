/**
 * Parse internal-staff profile fields (department / cost centre / monthly salary) from a request
 * body. Only keys present on the body are included, so callers can send partial patches. String
 * fields are trimmed; empty strings clear the value (null). Returns `'invalid'` when a provided
 * value fails validation (currently: a non-numeric or negative salary).
 */
export type StaffProfilePatch = {
  department?: string | null;
  costCenterCode?: string | null;
  costCenterName?: string | null;
  monthlySalary?: number | null;
};

function parseOptionalString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseStaffProfileBody(b: Record<string, unknown>): StaffProfilePatch | 'invalid' {
  const patch: StaffProfilePatch = {};

  if ('department' in b) patch.department = parseOptionalString(b.department);
  if ('costCenterCode' in b) patch.costCenterCode = parseOptionalString(b.costCenterCode);
  if ('costCenterName' in b) patch.costCenterName = parseOptionalString(b.costCenterName);

  if ('monthlySalary' in b) {
    const raw = b.monthlySalary;
    if (raw === null || raw === '' || raw === undefined) {
      patch.monthlySalary = null;
    } else {
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(num) || num < 0) return 'invalid';
      patch.monthlySalary = num;
    }
  }

  return patch;
}
