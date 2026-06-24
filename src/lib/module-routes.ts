import type { ModuleKey } from '@/lib/modules';

export type RouteModuleBinding = {
  prefix: string;
  module: ModuleKey;
};

/**
 * Longest-prefix wins when resolving a path to a licensed module.
 * Order in this array does not matter — bindings are sorted by prefix length at runtime.
 */
export const ROUTE_MODULE_BINDINGS: RouteModuleBinding[] = [
  // —— Recruitment (ATS) ——
  { prefix: '/careers', module: 'ats' },
  { prefix: '/interview', module: 'ats' },
  { prefix: '/api/jobs', module: 'ats' },
  { prefix: '/api/applications', module: 'ats' },
  { prefix: '/api/candidates', module: 'ats' },
  { prefix: '/api/interviews', module: 'ats' },
  { prefix: '/api/careers', module: 'ats' },
  { prefix: '/dashboard/jobs', module: 'ats' },
  { prefix: '/dashboard/applications', module: 'ats' },
  { prefix: '/dashboard/candidates', module: 'ats' },
  { prefix: '/dashboard/interviews', module: 'ats' },
  { prefix: '/dashboard/schedule', module: 'ats' },

  // —— Payroll ——
  { prefix: '/api/payroll', module: 'payroll' },
  { prefix: '/api/outsourcing/payroll', module: 'payroll' },
  { prefix: '/dashboard/payroll', module: 'payroll' },
  { prefix: '/dashboard/people', module: 'core' },
  { prefix: '/dashboard/operations', module: 'reports' },
  { prefix: '/dashboard/procurement', module: 'procurement' },
  { prefix: '/api/procurement', module: 'procurement' },
  { prefix: '/dashboard/projects', module: 'core' },
  { prefix: '/dashboard/legal', module: 'legal' },
  { prefix: '/dashboard/payroll/disbursements', module: 'payroll' },
  { prefix: '/dashboard/accounts/payroll', module: 'payroll' },

  // —— Time & attendance ——
  { prefix: '/api/rota', module: 'time' },
  { prefix: '/api/biometric', module: 'time' },
  { prefix: '/api/cron/biometric-poll', module: 'time' },
  { prefix: '/api/outsourcing/attendance', module: 'time' },
  { prefix: '/dashboard/rota', module: 'time' },
  { prefix: '/dashboard/attendance', module: 'time' },
  { prefix: '/dashboard/biometric-devices', module: 'time' },

  // —— Leave ——
  { prefix: '/api/ess/leave', module: 'leave' },
  { prefix: '/api/staff/leave', module: 'leave' },
  { prefix: '/api/leave', module: 'leave' },
  { prefix: '/dashboard/leave', module: 'leave' },
  { prefix: '/dashboard/outsourcing/leave', module: 'leave' },
  { prefix: '/api/ess/home-summary', module: 'ess' },
  { prefix: '/api/ess/team', module: 'leave' },
  { prefix: '/api/ess/documents', module: 'core' },
  { prefix: '/api/ess/credentials', module: 'core' },
  { prefix: '/api/ess/onboarding', module: 'core' },
  { prefix: '/api/ess/rota', module: 'time' },
  { prefix: '/api/ess/assets', module: 'assets' },
  { prefix: '/api/ess/pay', module: 'payroll' },
  { prefix: '/api/ess/attendance/clock', module: 'time' },
  { prefix: '/api/ess/hse', module: 'hse' },
  { prefix: '/ess/work', module: 'ess' },
  { prefix: '/ess/pay', module: 'payroll' },
  { prefix: '/ess/team', module: 'leave' },
  { prefix: '/ess/more', module: 'ess' },
  { prefix: '/ess/leave', module: 'leave' },
  { prefix: '/ess/leave-approvals', module: 'leave' },
  { prefix: '/ess/rota', module: 'time' },
  { prefix: '/ess/onboarding', module: 'core' },
  { prefix: '/ess/documents', module: 'core' },
  { prefix: '/ess/credentials', module: 'core' },
  { prefix: '/ess/assets', module: 'assets' },
  { prefix: '/ess/hse', module: 'hse' },
  { prefix: '/ess/performance', module: 'performance' },
  { prefix: '/ess/profile', module: 'ess' },
  { prefix: '/ess/install', module: 'ess' },
  { prefix: '/ess/offline', module: 'ess' },
  { prefix: '/ess/payslips', module: 'payroll' },
  { prefix: '/ess/attendance', module: 'time' },

  // —— Performance ——
  { prefix: '/dashboard/performance', module: 'performance' },
  { prefix: '/dashboard/people/performance', module: 'performance' },

  // —— HSE ——
  { prefix: '/dashboard/hse', module: 'hse' },
  { prefix: '/api/hse', module: 'hse' },

  // —— Accounts / finance ——
  { prefix: '/api/accounts', module: 'accounts' },
  { prefix: '/api/finance', module: 'accounts' },
  { prefix: '/dashboard/accounts', module: 'accounts' },

  // —— Disciplinary ——
  { prefix: '/api/disciplinary', module: 'disciplinary' },
  { prefix: '/api/grievances', module: 'disciplinary' },
  { prefix: '/api/ess/disciplinary', module: 'disciplinary' },
  { prefix: '/api/ess/grievances', module: 'disciplinary' },
  { prefix: '/dashboard/disciplinary', module: 'disciplinary' },
  { prefix: '/ess/disciplinary', module: 'disciplinary' },
  { prefix: '/ess/grievances', module: 'disciplinary' },

  // —— Reports ——
  { prefix: '/api/reports', module: 'reports' },
  { prefix: '/dashboard/reports', module: 'reports' },
  { prefix: '/dashboard/analytics', module: 'reports' },

  // —— Asset manager ——
  { prefix: '/api/assets', module: 'assets' },
  { prefix: '/dashboard/assets', module: 'assets' },
  { prefix: '/api/fleet', module: 'fleet' },
  { prefix: '/dashboard/fleet', module: 'fleet' },

  // —— ESS (portal shell) ——
  { prefix: '/api/ess', module: 'ess' },
  { prefix: '/ess', module: 'ess' },

  // —— Communications ——
  { prefix: '/api/announcements', module: 'communications' },
  { prefix: '/dashboard/announcements', module: 'communications' },

  // —— Training & Development ——
  { prefix: '/api/training', module: 'training' },
  { prefix: '/dashboard/training', module: 'training' },
  { prefix: '/dashboard/org-chart', module: 'training' },

  // —— Document Management ——
  { prefix: '/api/company-documents', module: 'documents' },
  { prefix: '/dashboard/company-documents', module: 'documents' },

  // —— Core HR (employees, org, onboarding, credentials) ——
  { prefix: '/api/onboarding', module: 'core' },
  { prefix: '/api/outsourcing/employees', module: 'core' },
  { prefix: '/api/outsourcing/ess', module: 'ess' },
  { prefix: '/api/outsourcing/document-requests', module: 'ess' },
  { prefix: '/dashboard/ess/portal-accounts', module: 'ess' },
  { prefix: '/dashboard/ess/shifts', module: 'ess' },
  { prefix: '/dashboard/ess/document-requests', module: 'ess' },
  { prefix: '/dashboard/outsourcing', module: 'core' },
  { prefix: '/api/employees', module: 'core' },
  { prefix: '/api/departments', module: 'core' },
  { prefix: '/api/credentials', module: 'core' },
  { prefix: '/dashboard/employees', module: 'core' },
  { prefix: '/dashboard/departments', module: 'core' },
  { prefix: '/dashboard/onboarding', module: 'core' },
  { prefix: '/dashboard/credentials', module: 'core' },
  { prefix: '/dashboard/people/contracts', module: 'core' },
  { prefix: '/dashboard/people/tasks', module: 'core' },
  { prefix: '/dashboard/users', module: 'core' },
  { prefix: '/dashboard/admin', module: 'core' },
  { prefix: '/dashboard/settings', module: 'core' },
  { prefix: '/dashboard/insights', module: 'core' },
];

const SORTED_BINDINGS = [...ROUTE_MODULE_BINDINGS].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

/** Paths that bypass module licensing checks (auth, health, config, crons with own secrets). */
export const MODULE_GUARD_EXEMPT_PREFIXES = [
  '/api/auth',
  '/api/config',
  '/api/webhooks',
  '/api/cron/contract-reminders',
  '/api/cron/credential-reminders',
  '/api/cron/onboarding-overdue',
  '/dashboard/login',
  '/dashboard/forgot-password',
  '/dashboard/module-unavailable',
  '/ess/login',
  '/ess/offline',
  '/ess/account-security',
  '/api/ess/manifest',
  '/privacy',
  '/terms',
  '/manifest',
  '/_next',
  '/favicon',
  '/brand',
  '/uploads',
];

export function isModuleGuardExempt(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (path === '/' || path === '/dashboard' || path === '/dashboard/') return true;
  return MODULE_GUARD_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function normalizePath(pathname: string): string {
  const base = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base;
}

export function resolveModuleForPath(pathname: string): ModuleKey | null {
  const path = normalizePath(pathname);
  if (isModuleGuardExempt(path)) return null;

  for (const binding of SORTED_BINDINGS) {
    if (path === binding.prefix || path.startsWith(`${binding.prefix}/`)) {
      return binding.module;
    }
  }
  return null;
}

/** Dashboard nav section → required module(s). Section shown if any listed module is enabled. */
export const NAV_SECTION_MODULES: Record<string, ModuleKey[]> = {
  'people-hr': ['core'],
  recruitment: ['ats'],
  'time-attendance': ['time', 'leave'],
  operations: ['fleet', 'assets', 'hse'],
  'communications-insight': ['communications', 'reports'],
  payroll: ['payroll'],
  'employee-self-service': ['ess'],
  finance: ['accounts'],
  procurement: ['procurement'],
  'legal-documents': ['legal', 'documents'],
  projects: ['core'],
  development: ['training'],
  admin: ['core'],
};

/** Nav item href → module. Items without an entry inherit section module. */
export const NAV_ITEM_MODULES: Record<string, ModuleKey> = {
  '/dashboard/performance': 'performance',
  '/dashboard/disciplinary': 'disciplinary',
  '/dashboard/leave': 'leave',
  '/dashboard/rota': 'time',
  '/dashboard/attendance': 'time',
  '/dashboard/biometric-devices': 'time',
  '/dashboard/announcements': 'communications',
  '/dashboard/company-documents': 'documents',
  '/dashboard/legal': 'legal',
  '/dashboard/legal/obligations': 'legal',
  '/dashboard/procurement': 'procurement',
  '/dashboard/procurement/purchase-requests': 'procurement',
  '/dashboard/procurement/lpos': 'procurement',
  '/dashboard/procurement/spend': 'procurement',
  '/dashboard/projects': 'core',
  '/dashboard/projects/board': 'core',
  '/dashboard/projects/tasks': 'core',
  '/dashboard/payroll/disbursements': 'payroll',
  '/dashboard/admin/facilities': 'core',
  '/dashboard/admin/governance': 'core',
  '/dashboard/people/contracts': 'core',
  '/dashboard/credentials': 'core',
  '/dashboard/training': 'training',
  '/dashboard/org-chart': 'training',
};

/** ESS bottom-nav href → module */
export const ESS_NAV_MODULES: Record<string, ModuleKey> = {
  '/ess/leave': 'leave',
  '/ess/leave-approvals': 'leave',
  '/ess/team/leave': 'leave',
  '/ess/team/calendar': 'leave',
  '/ess/team/attendance': 'time',
  '/ess/payslips': 'payroll',
  '/ess/pay/ytd': 'payroll',
  '/ess/pay/tax-certificates': 'payroll',
  '/ess/pay/bank-details': 'payroll',
  '/ess/attendance': 'time',
  '/ess/attendance/clock': 'time',
  '/ess/rota': 'time',
  '/ess/onboarding': 'core',
  '/ess/documents': 'core',
  '/ess/credentials': 'core',
  '/ess/disciplinary': 'disciplinary',
  '/ess/grievances': 'disciplinary',
  '/ess/hse': 'hse',
  '/ess/assets': 'assets',
  '/ess/performance': 'performance',
};
