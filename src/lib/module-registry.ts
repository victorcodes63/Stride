/**
 * MOD-01 (RAV-285): Single source of truth for Stride capabilities.
 * One row per ModuleKey — domain, nav section, bucket, licensing, and dependencies.
 * Keys are stable; labels are customer-facing display aliases only.
 */

import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';

export type ModuleBucket = 'foundational' | 'horizontal' | 'vertical';
export type ModulePhase = 1 | 2 | 3;
/** Product readiness — marketing badges and compare tables derive from this field. */
export type ModuleReadiness = 'live' | 'partial' | 'planned';

export const MODULE_KEYS = [
  'core',
  'ess',
  'leave',
  'time',
  'payroll',
  'disciplinary',
  'accounts',
  'reports',
  'documents',
  'communications',
  'ats',
  'performance',
  'training',
  'procurement',
  'legal',
  'projects',
  'operations',
  'outsourcing',
  'sales',
  'assessments',
  'fleet',
  'assets',
  'hse',
  'sacco',
  'healthcare',
  'energy',
  'construction',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleRegistryEntry = {
  key: ModuleKey;
  /** Customer-facing label (display alias; never rename `key`). */
  label: string;
  domainId: DashboardModuleDomainId;
  navSectionId: string;
  bucket: ModuleBucket;
  phase: ModulePhase;
  billable: boolean;
  requires?: readonly ModuleKey[];
  envVar: string;
  description: string;
  /** When false, the module cannot be disabled (always on). */
  canDisable: boolean;
  /** Shipping status — flip to `live` when acceptance criteria are met. */
  readiness: ModuleReadiness;
};

export const MODULE_REGISTRY: readonly ModuleRegistryEntry[] = [
  // —— Foundational ——
  {
    key: 'core',
    label: 'People',
    domainId: 'hr-payroll',
    navSectionId: 'people-hr',
    bucket: 'foundational',
    phase: 1,
    billable: false,
    canDisable: false,
    envVar: 'MODULE_CORE',
    description: 'Employee directory, org chart, profiles, documents, and ESS — the platform base.',
    readiness: 'live',
  },
  {
    key: 'ess',
    label: 'Employee Self-Service',
    domainId: 'hr-payroll',
    navSectionId: 'employee-self-service',
    bucket: 'foundational',
    phase: 1,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_ESS',
    description: 'Employee portal for leave, payslips, attendance, and cases.',
    readiness: 'live',
  },
  {
    key: 'leave',
    label: 'Leave',
    domainId: 'hr-payroll',
    navSectionId: 'time-attendance',
    bucket: 'foundational',
    phase: 1,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_LEAVE',
    description: 'Leave policies, balances, approvals, and statutory leave pay.',
    readiness: 'live',
  },
  {
    key: 'time',
    label: 'Time & Attendance',
    domainId: 'hr-payroll',
    navSectionId: 'time-attendance',
    bucket: 'foundational',
    phase: 1,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_TIME',
    description: 'Rota, attendance, biometrics, and shift scheduling.',
    readiness: 'live',
  },
  {
    key: 'payroll',
    label: 'Payroll',
    domainId: 'hr-payroll',
    navSectionId: 'payroll',
    bucket: 'foundational',
    phase: 1,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_PAYROLL',
    description: 'KE/UG statutory payroll, M-Pesa disbursement, payslips, and bank export.',
    readiness: 'live',
  },
  {
    key: 'disciplinary',
    label: 'Disciplinary & Grievance',
    domainId: 'hr-payroll',
    navSectionId: 'people-hr',
    bucket: 'foundational',
    phase: 1,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_DISCIPLINARY',
    description: 'Disciplinary cases and grievance workflows.',
    readiness: 'live',
  },
  {
    key: 'accounts',
    label: 'Finance',
    domainId: 'finance',
    navSectionId: 'finance',
    bucket: 'foundational',
    phase: 1,
    billable: false,
    canDisable: false,
    envVar: 'MODULE_ACCOUNTS',
    description: 'Expenses, approvals, reimbursements, invoicing, and core GL hooks.',
    readiness: 'live',
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    domainId: 'admin-operations',
    navSectionId: 'communications-insight',
    bucket: 'foundational',
    phase: 1,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_REPORTS',
    description: 'Workforce reports and executive analytics.',
    readiness: 'live',
  },
  {
    key: 'documents',
    label: 'Document Management',
    domainId: 'legal-documents',
    navSectionId: 'legal-documents',
    bucket: 'foundational',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_DOCUMENTS',
    description: 'Company policies, SOPs, handbooks, and shared documents.',
    readiness: 'live',
  },
  {
    key: 'communications',
    label: 'Communications',
    domainId: 'admin-operations',
    navSectionId: 'communications-insight',
    bucket: 'foundational',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_COMMUNICATIONS',
    description: 'Company announcements, notices, and internal communications.',
    readiness: 'live',
  },

  // —— Horizontal ——
  {
    key: 'ats',
    label: 'Recruitment & talent',
    domainId: 'hr-payroll',
    navSectionId: 'recruitment',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    requires: ['core'],
    canDisable: true,
    envVar: 'MODULE_ATS',
    description: 'Careers site, ATS, onboarding, and talent pipeline.',
    readiness: 'live',
  },
  {
    key: 'performance',
    label: 'Performance management',
    domainId: 'hr-payroll',
    navSectionId: 'people-hr',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    requires: ['core'],
    canDisable: true,
    envVar: 'MODULE_PERFORMANCE',
    description: 'Goals, review cycles, scorecards, and performance management.',
    readiness: 'live',
  },
  {
    key: 'training',
    label: 'Training & Development',
    domainId: 'hr-payroll',
    navSectionId: 'development',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_TRAINING',
    description: 'Training programs, enrollments, org chart, and skill development.',
    readiness: 'live',
  },
  {
    key: 'procurement',
    label: 'Procurement',
    domainId: 'procurement',
    navSectionId: 'procurement',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_PROCUREMENT',
    description: 'Purchase requests, LPOs, vendor spend, and procurement workflows.',
    readiness: 'live',
  },
  {
    key: 'legal',
    label: 'Legal & Compliance',
    domainId: 'legal-documents',
    navSectionId: 'legal-documents',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_LEGAL',
    description: 'Contracts, credentials, obligations, and compliance tracking.',
    readiness: 'live',
  },
  {
    key: 'projects',
    label: 'Project Management',
    domainId: 'projects',
    navSectionId: 'projects',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_PROJECTS',
    description: 'Project register, kanban board, tasks, deliverables, and budget vs actual.',
    readiness: 'live',
  },
  {
    key: 'operations',
    label: 'Operations',
    domainId: 'admin-operations',
    navSectionId: 'operations',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_OPERATIONS',
    description: 'Assets, HSE, announcements, and operational reporting hub.',
    readiness: 'live',
  },
  {
    key: 'outsourcing',
    label: 'HR Outsourcing (BPO)',
    domainId: 'hr-outsourcing',
    navSectionId: 'outsourcing-clients',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_OUTSOURCING',
    description:
      'End-client register, outsourced workforce, and per-client payroll, attendance, and leave.',
    readiness: 'live',
  },
  {
    key: 'sales',
    label: 'Sales',
    domainId: 'sales',
    navSectionId: 'sales',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    requires: ['performance'],
    canDisable: true,
    envVar: 'MODULE_SALES',
    description: 'Sales pipeline KPIs and scorecard auto-measures for revenue roles.',
    readiness: 'live',
  },
  {
    key: 'assessments',
    label: 'Candidate assessments',
    domainId: 'hr-payroll',
    navSectionId: 'recruitment',
    bucket: 'horizontal',
    phase: 2,
    billable: true,
    requires: ['ats'],
    canDisable: true,
    envVar: 'MODULE_ASSESSMENTS',
    description: 'AssessIQ templates, assignments, and candidate assessment attempts.',
    readiness: 'partial',
  },

  // —— Vertical ——
  {
    key: 'fleet',
    label: 'Fleet & Logistics',
    domainId: 'fleet-logistics',
    navSectionId: 'fleet-operations',
    bucket: 'vertical',
    phase: 3,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_FLEET',
    description: 'Transport orders, trip workflow, fleet register, and logistics operations.',
    readiness: 'live',
  },
  {
    key: 'assets',
    label: 'Asset Manager',
    domainId: 'admin-operations',
    navSectionId: 'operations',
    bucket: 'vertical',
    phase: 3,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_ASSETS',
    description: 'Company asset registry, assignments, and lifecycle tracking.',
    readiness: 'live',
  },
  {
    key: 'hse',
    label: 'HSE',
    domainId: 'admin-operations',
    navSectionId: 'operations',
    bucket: 'vertical',
    phase: 3,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_HSE',
    description: 'Health, safety, and environment incident tracking.',
    readiness: 'live',
  },
  {
    key: 'sacco',
    label: 'SACCO',
    domainId: 'hr-payroll',
    navSectionId: 'sacco',
    bucket: 'vertical',
    phase: 3,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_SACCO',
    description: 'Member ledger, BOSA/FOSA accounts, dividend runs, and SASRA reporting templates.',
    readiness: 'planned',
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    domainId: 'hr-payroll',
    navSectionId: 'healthcare',
    bucket: 'vertical',
    phase: 3,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_HEALTHCARE',
    description: 'Clinical rota rules, licence gates on shifts, and NHIF/SHIF compliance hooks.',
    readiness: 'planned',
  },
  {
    key: 'energy',
    label: 'Energy',
    domainId: 'hr-payroll',
    navSectionId: 'energy',
    bucket: 'vertical',
    phase: 3,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_ENERGY',
    description: 'Permit tracking, site register, and multi-entity HSE rollup for energy operators.',
    readiness: 'planned',
  },
  {
    key: 'construction',
    label: 'Construction',
    domainId: 'hr-payroll',
    navSectionId: 'construction',
    bucket: 'vertical',
    phase: 3,
    billable: true,
    canDisable: true,
    envVar: 'MODULE_CONSTRUCTION',
    description: 'Site hierarchy, plant asset tracking, and subcontractor accounts payable.',
    readiness: 'planned',
  },
] as const;

const REGISTRY_BY_KEY = Object.fromEntries(MODULE_REGISTRY.map((row) => [row.key, row])) as Record<
  ModuleKey,
  ModuleRegistryEntry
>;

export function getModuleRegistryEntry(key: ModuleKey): ModuleRegistryEntry {
  return REGISTRY_BY_KEY[key];
}

export function moduleEnvVar(key: ModuleKey): string {
  return REGISTRY_BY_KEY[key].envVar;
}

/** Bucket map derived from the registry — used by entitlement quotas. */
export const MODULE_BUCKET: Record<ModuleKey, ModuleBucket> = Object.fromEntries(
  MODULE_REGISTRY.map((row) => [row.key, row.bucket]),
) as Record<ModuleKey, ModuleBucket>;

export type ModuleUiGroup = {
  id: string;
  label: string;
  description: string;
  keys: ModuleKey[];
};

/** Product-domain order for Company Setup — matches the module switcher. */
const COMPANY_SETUP_DOMAIN_ORDER: DashboardModuleDomainId[] = [
  'hr-payroll',
  'sales',
  'finance',
  'procurement',
  'legal-documents',
  'projects',
  'fleet-logistics',
  'hr-outsourcing',
  'admin-operations',
];

const COMPANY_SETUP_DOMAIN_META: Record<
  DashboardModuleDomainId,
  { label: string; description: string }
> = {
  'hr-payroll': {
    label: 'HR & Payroll',
    description: 'People, leave, time, payroll, ESS, and disciplinary.',
  },
  sales: {
    label: 'Sales',
    description: 'Pipeline KPIs, targets, and scorecard auto-measures for revenue roles.',
  },
  finance: {
    label: 'Finance',
    description: 'Invoicing, AP, expenses, budgets, and financial reports.',
  },
  procurement: {
    label: 'Procurement',
    description: 'Purchase requests, LPOs, vendor spend, and approvals.',
  },
  'legal-documents': {
    label: 'Legal & Documents',
    description: 'Contracts, credentials, policies, and compliance obligations.',
  },
  projects: {
    label: 'Projects',
    description: 'Deliverables, tasks, and budget vs execution.',
  },
  'fleet-logistics': {
    label: 'Fleet management',
    description: 'Transport orders, dispatch, telematics, compliance, and client billing.',
  },
  'hr-outsourcing': {
    label: 'HR Outsourcing',
    description: 'End-client register and outsourced workforce services.',
  },
  'admin-operations': {
    label: 'Operations',
    description: 'Assets, HSE, announcements, and operational reporting.',
  },
  'platform-admin': {
    label: 'Platform admin',
    description: 'Company setup and workspace administration.',
  },
};

function describeHrPayrollDomain(flags?: Partial<Record<ModuleKey, boolean>>): string {
  const parts = ['People', 'leave', 'time', 'payroll', 'ESS', 'disciplinary'];
  if (flags?.ats === true) parts.push('recruitment');
  if (flags?.performance === true) parts.push('performance management');
  if (flags?.training === true) parts.push('training');
  return `${parts.join(', ')}.`;
}

function describeSalesDomain(): string {
  return 'Pipeline KPIs, targets, attainment, and scorecard auto-measures.';
}

function describeDomain(
  domainId: DashboardModuleDomainId,
  flags?: Partial<Record<ModuleKey, boolean>>,
): string {
  if (domainId === 'hr-payroll') return describeHrPayrollDomain(flags);
  if (domainId === 'sales') return describeSalesDomain();
  return COMPANY_SETUP_DOMAIN_META[domainId].description;
}

/** Company Setup toggle groups — one product domain per group, derived from the registry. */
export function buildModuleUiGroups(
  enabledFlags?: Partial<Record<ModuleKey, boolean>>,
): ModuleUiGroup[] {
  const keysByDomain = new Map<DashboardModuleDomainId, ModuleKey[]>();
  for (const row of MODULE_REGISTRY) {
    const list = keysByDomain.get(row.domainId) ?? [];
    list.push(row.key);
    keysByDomain.set(row.domainId, list);
  }

  return COMPANY_SETUP_DOMAIN_ORDER.flatMap((domainId) => {
    const keys = keysByDomain.get(domainId);
    if (!keys?.length) return [];
    const meta = COMPANY_SETUP_DOMAIN_META[domainId];
    return [
      {
        id: domainId,
        label: meta.label,
        description: describeDomain(domainId, enabledFlags),
        keys,
      },
    ];
  });
}

export const MODULE_UI_GROUPS: ModuleUiGroup[] = buildModuleUiGroups();

/** Sections whose module keys extend beyond a single registry navSectionId (fleet/outsourcing/admin). */
const NAV_SECTION_MODULE_EXTENSIONS: Record<string, readonly ModuleKey[]> = {
  admin: ['core'],
  'fleet-monitoring': ['fleet'],
  'fleet-assets': ['fleet'],
  'fleet-commercial': ['fleet'],
  'outsourcing-workforce': ['outsourcing'],
  'outsourcing-services': ['outsourcing'],
};

/** Dashboard nav section → required module(s). Derived from registry navSectionId. */
export function buildNavSectionModules(): Record<string, ModuleKey[]> {
  const map = new Map<string, ModuleKey[]>();

  for (const row of MODULE_REGISTRY) {
    const list = map.get(row.navSectionId) ?? [];
    if (!list.includes(row.key)) list.push(row.key);
    map.set(row.navSectionId, list);
  }

  for (const [sectionId, keys] of Object.entries(NAV_SECTION_MODULE_EXTENSIONS)) {
    const existing = map.get(sectionId) ?? [];
    map.set(sectionId, [...new Set([...existing, ...keys])]);
  }

  return Object.fromEntries(map);
}

export const NAV_SECTION_MODULES: Record<string, ModuleKey[]> = buildNavSectionModules();
