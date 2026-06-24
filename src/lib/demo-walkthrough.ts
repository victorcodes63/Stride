/**
 * Canonical demo walkthrough — HR & payroll paths that must stay live for Phase A (RAV-73).
 */

export type DemoWalkthroughStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  /** Suggested login (see demo-credentials.ts) */
  persona?: 'admin' | 'hr' | 'finance' | 'ess';
  minutes?: number;
};

export const DEMO_WALKTHROUGH_STEPS: DemoWalkthroughStep[] = [
  {
    id: 'employees',
    title: 'Employee directory',
    description: '~40 staff with PIN, NSSF, and bank details for payroll validation.',
    href: '/dashboard/employees',
    persona: 'hr',
    minutes: 2,
  },
  {
    id: 'leave',
    title: 'Leave hub',
    description: 'Employees tab — queue, team calendar, accrual balances, liability report.',
    href: '/dashboard/leave',
    persona: 'hr',
    minutes: 3,
  },
  {
    id: 'payroll-wizard',
    title: 'Payroll run wizard',
    description: 'Validate → generate → review variance → approve → export or M-Pesa disburse.',
    href: '/dashboard/payroll',
    persona: 'finance',
    minutes: 5,
  },
  {
    id: 'disbursements',
    title: 'M-Pesa disbursements',
    description: 'Submit a sandbox batch against an approved payroll month.',
    href: '/dashboard/payroll/disbursements',
    persona: 'finance',
    minutes: 2,
  },
  {
    id: 'performance',
    title: 'Performance reviews',
    description: 'Active H1 cycle with goals and manager/self review progress.',
    href: '/dashboard/performance',
    persona: 'hr',
    minutes: 3,
  },
  {
    id: 'ess-leave',
    title: 'ESS — employee leave',
    description: 'Employee self-service leave balances and requests.',
    href: '/ess/leave',
    persona: 'ess',
    minutes: 2,
  },
  {
    id: 'ess-performance',
    title: 'ESS — self review',
    description: 'Employee completes self-assessment in the active cycle.',
    href: '/ess/performance',
    persona: 'ess',
    minutes: 2,
  },
];

export const DEMO_HR_PRIMARY_PATHS = DEMO_WALKTHROUGH_STEPS.map((s) => s.href);
