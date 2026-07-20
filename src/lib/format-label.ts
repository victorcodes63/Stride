/**
 * Shared label formatter for UI option labels (dropdowns, filters, badges).
 *
 * The platform's house style for option labels is **sentence case**
 * ("All statuses", "In progress", "By department"). Enum values are stored in
 * UPPER_SNAKE_CASE, so rendering them raw ("UNDER_INVESTIGATION") or with a
 * plain underscore-strip ("UNDER INVESTIGATION") produces the inconsistent
 * casing we want to avoid.
 *
 * `toDisplayLabel` normalizes an enum/token to sentence case while keeping
 * domain acronyms (KRA, NSSF, VAT, …) uppercase.
 *
 * IMPORTANT: only use this for enum/token values (UPPER_SNAKE_CASE constants).
 * Do NOT run it over free-text data such as names, positions, counties or
 * user-entered categories — those already carry their intended casing.
 *
 * To switch the whole platform to Title Case instead, change `capitalizeWord`
 * to capitalize every word (not just the first).
 */

/** Domain acronyms that must stay uppercase. */
const ACRONYMS = new Set([
  'KRA', 'NSSF', 'NHIF', 'SHIF', 'SHA', 'PAYE', 'VAT', 'NITA', 'HELB', 'PIN',
  'ID', 'KYC', 'HSE', 'PPE', 'GPS', 'HR', 'KES', 'USD', 'EUR', 'GBP', 'TZS',
  'UGX', 'RWF', 'SACCO', 'ATS', 'ESS', 'PDF', 'CSV', 'XLSX', 'URL', 'API',
  'LPO', 'GRN', 'VIN', 'KPI', 'MPESA', 'NGO', 'DOB', 'AWOL', 'CEO', 'CFO',
  'COO', 'SLA', 'OTP', 'SMS', 'PO',
]);

function capitalizeWord(word: string, isFirst: boolean): string {
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  const lower = word.toLowerCase();
  // Sentence case: only the first word is capitalized.
  if (isFirst) return lower.charAt(0).toUpperCase() + lower.slice(1);
  return lower;
}

/**
 * Convert an enum/token (e.g. "UNDER_INVESTIGATION", "hearing-scheduled") to a
 * sentence-cased, human-readable label (e.g. "Under investigation").
 */
export function toDisplayLabel(value: string): string {
  if (!value) return value;
  const words = value
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return value;
  return words.map((word, index) => capitalizeWord(word, index === 0)).join(' ');
}
