type SensitiveChange = {
  field: string;
  from: string;
  to: string;
};

const MASKED_FIELDS = new Set(['bankAccountNumber', 'idNumber', 'nationalId']);

function maskSensitive(field: string, value: unknown): string {
  if (value == null || value === '') return '(empty)';
  if (field === 'baseSalary' || field === 'salary') return '(changed)';
  const str = String(value);
  if (MASKED_FIELDS.has(field)) {
    if (str.length <= 4) return '***';
    return `${str.slice(0, 2)}***${str.slice(-2)}`;
  }
  return str;
}

export function diffSensitiveFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): SensitiveChange[] {
  return fields
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      field,
      from: maskSensitive(field, before[field]),
      to: maskSensitive(field, after[field]),
    }));
}
