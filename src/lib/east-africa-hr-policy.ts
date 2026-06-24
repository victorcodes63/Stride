/**
 * Configurable reference points for fair disciplinary & grievance handling across East Africa.
 * This is product guidance for HR workflows — always confirm with qualified labour counsel and
 * the employer’s registered policies, collective agreements, and sector regulators.
 */

export type LaborJurisdictionCode = 'KE' | 'UG' | 'TZ' | 'RW' | 'BI' | 'SS' | 'EAC';

export type JurisdictionPolicy = {
  code: LaborJurisdictionCode;
  label: string;
  primaryActs: string[];
  defaultShowCauseDays: number;
  /** Typical minimum calendar days between escalating formal warnings (product default; align with policy). */
  recommendedStepIntervalDays: number;
  fairProcessBullets: string[];
  grievanceBullets: string[];
};

export const JURISDICTION_POLICIES: Record<LaborJurisdictionCode, JurisdictionPolicy> = {
  KE: {
    code: 'KE',
    label: 'Kenya',
    primaryActs: ['Employment Act, 2007', 'Labour Relations Act, 2007 (collective context)'],
    defaultShowCauseDays: 7,
    recommendedStepIntervalDays: 7,
    fairProcessBullets: [
      'Investigate promptly and record allegations and responses.',
      'Notify the employee of the case against them in sufficient detail to prepare a defence.',
      'Allow reasonable time to respond in writing to a show-cause notice (commonly 7 days unless policy states otherwise).',
      'Where a hearing is held, ensure the employee may state their case and be accompanied as permitted by policy/law.',
      'Keep signed acknowledgments of warnings and hearing minutes where sanctions apply.',
      'For termination, follow statutory fair procedure and valid substantive grounds — confirm notice / payment obligations.',
    ],
    grievanceBullets: [
      'Acknowledge receipt and advise the employee of the grievance route and expected timelines.',
      'Investigate impartially; consider mediation or internal resolution steps before escalation.',
      'Document outcomes and communicate them to the employee in writing.',
    ],
  },
  UG: {
    code: 'UG',
    label: 'Uganda',
    primaryActs: ['Employment Act, 2006'],
    defaultShowCauseDays: 7,
    recommendedStepIntervalDays: 7,
    fairProcessBullets: [
      'Apply the employer’s disciplinary policy consistently.',
      'Give the employee a fair opportunity to respond before substantive sanctions.',
      'Maintain records of hearings and decisions.',
    ],
    grievanceBullets: [
      'Follow any statutory or contractual grievance steps.',
      'Keep investigation notes confidential where appropriate.',
    ],
  },
  TZ: {
    code: 'TZ',
    label: 'Tanzania',
    primaryActs: ['Employment and Labour Relations Act, 2004'],
    defaultShowCauseDays: 7,
    recommendedStepIntervalDays: 7,
    fairProcessBullets: [
      'Use written procedures aligned with registered workplace rules where applicable.',
      'Ensure the employee understands charges and has a chance to respond.',
      'Document progressive discipline where the policy requires it.',
    ],
    grievanceBullets: [
      'Route workplace disputes through agreed dispute-resolution steps.',
      'Escalate per policy and collective instruments where they exist.',
    ],
  },
  RW: {
    code: 'RW',
    label: 'Rwanda',
    primaryActs: ['Labour Law (2009) and related regulations'],
    defaultShowCauseDays: 7,
    recommendedStepIntervalDays: 7,
    fairProcessBullets: [
      'Apply transparent procedures and retain documentation of sanctions.',
      'Allow defence and representation as provided by internal rules.',
    ],
    grievanceBullets: [
      'Track grievances from submission through investigation and closure.',
    ],
  },
  BI: {
    code: 'BI',
    label: 'Burundi',
    primaryActs: ['Labour Code (context-dependent — verify current texts)'],
    defaultShowCauseDays: 7,
    recommendedStepIntervalDays: 7,
    fairProcessBullets: ['Align sanctions with written rules and natural justice principles.', 'Confirm bilingual notices if required by policy.'],
    grievanceBullets: ['Document each stage of the internal grievance path.'],
  },
  SS: {
    code: 'SS',
    label: 'South Sudan',
    primaryActs: ['Labour Act, 2017 (verify amendments)'],
    defaultShowCauseDays: 7,
    recommendedStepIntervalDays: 7,
    fairProcessBullets: ['Apply employer rules consistently.', 'Keep evidence of notice and hearing fairness.'],
    grievanceBullets: ['Use agreed internal mechanisms before external referral where possible.'],
  },
  EAC: {
    code: 'EAC',
    label: 'EAC (generic cross-border)',
    primaryActs: ['Host-country labour statutes', 'ILO Termination of Employment Convention, 1982 (No. 158) — principles'],
    defaultShowCauseDays: 7,
    recommendedStepIntervalDays: 7,
    fairProcessBullets: [
      'Select the host country’s labour frame for each employee/case.',
      'Standardise documentation (warnings, show-cause, hearings, outcomes) across entities while respecting local minima.',
    ],
    grievanceBullets: [
      'Use a single case file per grievance with jurisdiction tag and audit trail.',
    ],
  },
};

export const DISCIPLINARY_STATUSES = [
  'OPEN',
  'UNDER_INVESTIGATION',
  'HEARING_SCHEDULED',
  'AWAITING_RESPONSE',
  'RESOLVED',
  'ESCALATED',
  'CLOSED',
] as const;

export const GRIEVANCE_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INVESTIGATING',
  'RESOLVED',
  'ESCALATED',
  'WITHDRAWN',
] as const;

export function getJurisdictionPolicy(code: string | null | undefined): JurisdictionPolicy {
  const c = (code?.toUpperCase() as LaborJurisdictionCode) || 'KE';
  return JURISDICTION_POLICIES[c] ?? JURISDICTION_POLICIES.KE;
}

export function formatEnumLabel(value: string): string {
  return value.replaceAll('_', ' ');
}
