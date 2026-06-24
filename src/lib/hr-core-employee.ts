export const EMPLOYEE_LIFECYCLE_EVENTS = [
  'hire',
  'confirmation',
  'promotion',
  'transfer',
  'suspension',
  'separation',
] as const;

export type EmployeeLifecycleEventType = (typeof EMPLOYEE_LIFECYCLE_EVENTS)[number];

export type EmployeeProfileForCompleteness = {
  firstName?: string | null;
  lastName?: string | null;
  idNumber?: string | null;
  kraPin?: string | null;
  nssfNumber?: string | null;
  nhifNumber?: string | null;
  dateOfJoining?: Date | string | null;
  jobTitle?: string | null;
  departmentId?: string | null;
  costCenterCode?: string | null;
};

const REQUIRED_PROFILE_FIELDS: Array<keyof EmployeeProfileForCompleteness> = [
  'firstName',
  'lastName',
  'idNumber',
  'kraPin',
  'nssfNumber',
  'nhifNumber',
  'dateOfJoining',
  'jobTitle',
  'departmentId',
  'costCenterCode',
];

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return true;
}

export function getProfileCompleteness(profile: EmployeeProfileForCompleteness): {
  isComplete: boolean;
  missingFields: Array<keyof EmployeeProfileForCompleteness>;
} {
  const missingFields = REQUIRED_PROFILE_FIELDS.filter((field) => !hasValue(profile[field]));
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

export function assertEmployeeProfileCompleteness(profile: EmployeeProfileForCompleteness): void {
  const completeness = getProfileCompleteness(profile);
  if (!completeness.isComplete) {
    throw new Error(
      `Employee profile is incomplete. Missing required fields: ${completeness.missingFields.join(', ')}.`
    );
  }
}

export type EmployeeSearchPreset =
  | 'all'
  | 'incomplete_profile'
  | 'without_manager'
  | 'without_cost_centre'
  | 'on_probation'
  | 'suspended';

export function normalizeEmployeeSearchPreset(raw: string | null | undefined): EmployeeSearchPreset {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'incomplete_profile':
    case 'without_manager':
    case 'without_cost_centre':
    case 'on_probation':
    case 'suspended':
      return raw!.trim().toLowerCase() as EmployeeSearchPreset;
    default:
      return 'all';
  }
}
