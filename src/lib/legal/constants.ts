// Shared taxonomy, labels, and tone maps for the Legal & compliance module.
// Consumed by the obligations register, hub, analytics, calendar, and the
// LegalStatusBadge / PriorityBadge components so styling stays consistent.

export type LegalObligationCategory =
  | 'filing'
  | 'permit'
  | 'licence'
  | 'board'
  | 'regulator'
  | 'insurance'
  | 'other';

export type LegalObligationStatus = 'pending' | 'completed' | 'waived';

export type LegalObligationPriority = 'low' | 'medium' | 'high' | 'critical';

/** Derived urgency bucket used across the aggregated register + calendar. */
export type ObligationRegisterStatus = 'overdue' | 'due_soon' | 'ok' | 'completed' | 'waived';

export type ObligationSource = 'contract' | 'credential' | 'policy' | 'compliance';

export const OBLIGATION_CATEGORIES: readonly LegalObligationCategory[] = [
  'filing',
  'permit',
  'licence',
  'board',
  'regulator',
  'insurance',
  'other',
] as const;

export const OBLIGATION_STATUSES: readonly LegalObligationStatus[] = [
  'pending',
  'completed',
  'waived',
] as const;

export const OBLIGATION_PRIORITIES: readonly LegalObligationPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const CATEGORY_LABEL: Record<LegalObligationCategory, string> = {
  filing: 'Statutory filing',
  permit: 'Permit',
  licence: 'Licence',
  board: 'Board / governance',
  regulator: 'Regulator deadline',
  insurance: 'Insurance',
  other: 'Other',
};

export const STATUS_LABEL: Record<LegalObligationStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  waived: 'Waived',
};

export const PRIORITY_LABEL: Record<LegalObligationPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const REGISTER_STATUS_LABEL: Record<ObligationRegisterStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  ok: 'On track',
  completed: 'Completed',
  waived: 'Waived',
};

export const SOURCE_LABEL: Record<ObligationSource, string> = {
  contract: 'Contract',
  credential: 'Credential',
  policy: 'Policy',
  compliance: 'Obligation',
};

// Tailwind badge classes (background + text) tuned for the light dashboard surface.
export const STATUS_BADGE_CLASS: Record<LegalObligationStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border border-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  waived: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
};

export const REGISTER_STATUS_BADGE_CLASS: Record<ObligationRegisterStatus, string> = {
  overdue: 'bg-red-50 text-red-800 border border-red-200',
  due_soon: 'bg-amber-50 text-amber-800 border border-amber-200',
  ok: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  completed: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
  waived: 'bg-neutral-100 text-neutral-500 border border-neutral-200',
};

export const PRIORITY_BADGE_CLASS: Record<LegalObligationPriority, string> = {
  low: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
  medium: 'bg-sky-50 text-sky-800 border border-sky-200',
  high: 'bg-amber-50 text-amber-800 border border-amber-200',
  critical: 'bg-red-50 text-red-800 border border-red-200',
};

/** Numeric weight for sorting / risk scoring (higher = more urgent). */
export const PRIORITY_WEIGHT: Record<LegalObligationPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function isLegalObligationCategory(value: string): value is LegalObligationCategory {
  return (OBLIGATION_CATEGORIES as readonly string[]).includes(value);
}

export function isLegalObligationStatus(value: string): value is LegalObligationStatus {
  return (OBLIGATION_STATUSES as readonly string[]).includes(value);
}

export function isLegalObligationPriority(value: string): value is LegalObligationPriority {
  return (OBLIGATION_PRIORITIES as readonly string[]).includes(value);
}

export function selectOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): Array<{ value: T; label: string }> {
  return values.map((value) => ({ value, label: labels[value] }));
}
