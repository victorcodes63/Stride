/**
 * Platform-wide report catalog — the single source of truth for the Report Center.
 *
 * Every report is tagged with its owning `module` so it can be tier-gated: a report is
 * only interactive when its module is entitled + enabled for the tenant. Reports whose
 * endpoint is not yet implemented are marked `planned` so coverage stays visible across
 * the whole platform (and upgrade paths stay obvious) without shipping dead links.
 *
 * This file is client-safe: it imports types only, never server-only modules.
 */

import type { ModuleKey } from '@/lib/modules';
import type { DeploymentTier } from '@/lib/deployment-tier-shared';
import { MARKETING_TIER_ENTITLEMENTS } from '@/lib/marketing-pricing-entitlements';

export type ReportStatus = 'live' | 'planned';

export type ReportCategoryId =
  | 'people'
  | 'time'
  | 'payroll'
  | 'recruitment'
  | 'performance'
  | 'training'
  | 'compliance'
  | 'finance'
  | 'procurement'
  | 'operations'
  | 'hse'
  | 'projects'
  | 'sales'
  | 'fleet'
  | 'outsourcing'
  | 'documents'
  | 'verticals';

export type ReportCategory = {
  id: ReportCategoryId;
  label: string;
  description: string;
};

/** Ordered categories rendered as sections + filter chips. */
export const REPORT_CATEGORIES: ReportCategory[] = [
  { id: 'people', label: 'People & workforce', description: 'Headcount, movements, and diversity.' },
  { id: 'time', label: 'Time & attendance', description: 'Hours, overtime, lateness, and absence.' },
  { id: 'payroll', label: 'Payroll & statutory', description: 'Cost, PAYE/NSSF/SHIF, and filing files.' },
  { id: 'recruitment', label: 'Recruitment & talent', description: 'Hiring funnel and pipeline health.' },
  { id: 'performance', label: 'Performance', description: 'Review cycles, ratings, and goals.' },
  { id: 'training', label: 'Learning & development', description: 'Programs, enrolment, and completion.' },
  { id: 'compliance', label: 'Compliance & risk', description: 'Cases, grievances, and onboarding.' },
  { id: 'finance', label: 'Finance', description: 'Receivables, payables, and expenses.' },
  { id: 'procurement', label: 'Procurement', description: 'Requests, orders, and vendor spend.' },
  { id: 'operations', label: 'Assets & operations', description: 'Asset register and lifecycle.' },
  { id: 'hse', label: 'Health & safety', description: 'Incidents, severity, and lost-time.' },
  { id: 'projects', label: 'Projects', description: 'Portfolio status and budget vs actual.' },
  { id: 'sales', label: 'Sales', description: 'Pipeline, targets, and attainment.' },
  { id: 'fleet', label: 'Fleet & logistics', description: 'Trips, utilisation, and compliance.' },
  { id: 'outsourcing', label: 'HR outsourcing', description: 'Per-client workforce and billing.' },
  { id: 'documents', label: 'Legal & documents', description: 'Policies, contracts, and obligations.' },
  { id: 'verticals', label: 'Industry verticals', description: 'SACCO, healthcare, energy, construction.' },
];

const CATEGORY_LABEL: Record<ReportCategoryId, string> = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<ReportCategoryId, string>;

export function reportCategoryLabel(id: ReportCategoryId): string {
  return CATEGORY_LABEL[id] ?? id;
}

// —— Parameter model ——————————————————————————————————————————————

export type ReportParam =
  | { kind: 'date'; key: string; label: string; getDefault: () => string }
  | { kind: 'month'; key: string; label: string; getDefault: () => string }
  | {
      kind: 'range';
      fromKey: string;
      toKey: string;
      label: string;
      getFromDefault: () => string;
      getToDefault: () => string;
    };

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthYm(): string {
  return new Date().toISOString().slice(0, 7);
}

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function monthStartYmd(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

// —— Report definition ————————————————————————————————————————————

export type ReportVariant = { label: string; type: string };

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  /** Owning module — drives tier gating. */
  module: ModuleKey;
  category: ReportCategoryId;
  /** Lucide icon name — mapped to a component in the page. */
  icon: string;
  status: ReportStatus;
  /** Highlighted in the "Featured" rail. */
  featured?: boolean;
  keywords?: string[];
  params?: ReportParam[];
  /**
   * Builds the base endpoint (without `format`) from resolved param values.
   * Absent for `planned` reports.
   */
  endpoint?: (values: Record<string, string>, variant?: string) => string;
  /** Multi-file reports (e.g. statutory P9/P10/NSSF/SHIF). */
  variants?: ReportVariant[];
};

function qs(values: Record<string, string>, keys: string[]): string {
  const parts = keys
    .map((k) => (values[k] ? `${k}=${encodeURIComponent(values[k])}` : ''))
    .filter(Boolean);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const REPORT_CATALOG: ReportDefinition[] = [
  // —— People & workforce ——
  {
    id: 'headcount',
    title: 'Headcount',
    description: 'Active headcount by department, clinical mix, hires, and exits as of a date.',
    module: 'core',
    category: 'people',
    icon: 'Users',
    status: 'live',
    featured: true,
    keywords: ['employees', 'staff', 'department', 'attrition', 'diversity'],
    params: [{ kind: 'date', key: 'asOf', label: 'As of', getDefault: todayYmd }],
    endpoint: (v) => `/api/reports/headcount${qs(v, ['asOf'])}`,
  },
  {
    id: 'credentials',
    title: 'Credentials & licences',
    description: 'Validity status, 30/90-day expiry watchlist, and issuing bodies.',
    module: 'core',
    category: 'compliance',
    icon: 'BadgeCheck',
    status: 'live',
    keywords: ['licence', 'certification', 'expiry', 'compliance', 'renewal'],
    endpoint: () => '/api/reports/credentials',
  },
  {
    id: 'leave',
    title: 'Leave utilisation',
    description: 'Applications, days taken, and status breakdown by leave type.',
    module: 'leave',
    category: 'time',
    icon: 'CalendarOff',
    status: 'live',
    keywords: ['absence', 'annual leave', 'sick', 'balances'],
    params: [
      {
        kind: 'range',
        fromKey: 'from',
        toKey: 'to',
        label: 'Period',
        getFromDefault: monthStartYmd,
        getToDefault: todayYmd,
      },
    ],
    endpoint: (v) => `/api/reports/leave${qs(v, ['from', 'to'])}`,
  },

  // —— Time & attendance ——
  {
    id: 'attendance',
    title: 'Attendance summary',
    description: 'Hours worked, overtime, lateness, absences, and missed clock-outs.',
    module: 'time',
    category: 'time',
    icon: 'Clock3',
    status: 'live',
    featured: true,
    keywords: ['clock-in', 'timesheet', 'overtime', 'punctuality'],
    params: [
      {
        kind: 'range',
        fromKey: 'from',
        toKey: 'to',
        label: 'Period',
        getFromDefault: () => daysAgoYmd(30),
        getToDefault: todayYmd,
      },
    ],
    endpoint: (v) => `/api/reports/attendance${qs(v, ['from', 'to'])}`,
  },

  // —— Payroll & statutory ——
  {
    id: 'payroll-cost',
    title: 'Payroll cost',
    description: 'Gross, net, PAYE, NSSF, SHIF, and department totals for a period.',
    module: 'payroll',
    category: 'payroll',
    icon: 'Landmark',
    status: 'live',
    featured: true,
    keywords: ['salary', 'wages', 'paye', 'nssf', 'shif', 'cost'],
    params: [{ kind: 'month', key: 'period', label: 'Period', getDefault: monthYm }],
    endpoint: (v) => `/api/reports/payroll-cost${qs(v, ['period'])}`,
  },
  {
    id: 'statutory',
    title: 'Statutory returns',
    description: 'P9, P10, NSSF, and SHIF files formatted for submission portals.',
    module: 'payroll',
    category: 'payroll',
    icon: 'FileSpreadsheet',
    status: 'live',
    keywords: ['kra', 'p9', 'p10', 'nssf', 'shif', 'filing', 'tax'],
    params: [{ kind: 'month', key: 'period', label: 'Period', getDefault: monthYm }],
    variants: [
      { label: 'P9', type: 'p9' },
      { label: 'P10', type: 'p10' },
      { label: 'NSSF', type: 'nssf' },
      { label: 'SHIF', type: 'shif' },
    ],
    endpoint: (v, variant) => `/api/reports/statutory?period=${v.period}&type=${variant ?? 'p9'}`,
  },

  // —— Recruitment ——
  {
    id: 'recruitment',
    title: 'Hiring funnel',
    description: 'Applications by status, job pipeline, conversion rate, and upcoming interviews.',
    module: 'ats',
    category: 'recruitment',
    icon: 'Briefcase',
    status: 'live',
    keywords: ['ats', 'candidates', 'jobs', 'pipeline', 'interviews', 'conversion'],
    endpoint: () => '/api/reports/recruitment',
  },

  // —— Compliance & risk ——
  {
    id: 'compliance',
    title: 'Disciplinary, grievances & onboarding',
    description: 'Open cases, grievance queue, and active onboarding workflows.',
    module: 'disciplinary',
    category: 'compliance',
    icon: 'Shield',
    status: 'live',
    keywords: ['discipline', 'grievance', 'case', 'onboarding', 'risk'],
    endpoint: () => '/api/reports/compliance',
  },

  // —— Learning & development ——
  {
    id: 'training',
    title: 'Training & development',
    description: 'Programs, enrolments, completion rates, cost, and certification status.',
    module: 'training',
    category: 'training',
    icon: 'GraduationCap',
    status: 'live',
    keywords: ['learning', 'course', 'enrolment', 'completion', 'certificate', 'skills'],
    params: [
      {
        kind: 'range',
        fromKey: 'from',
        toKey: 'to',
        label: 'Period',
        getFromDefault: () => daysAgoYmd(180),
        getToDefault: todayYmd,
      },
    ],
    endpoint: (v) => `/api/reports/training${qs(v, ['from', 'to'])}`,
  },

  // —— Finance ——
  {
    id: 'expenses',
    title: 'Expense claims',
    description: 'Claim volume and value by status and department, with reimbursement backlog.',
    module: 'accounts',
    category: 'finance',
    icon: 'Receipt',
    status: 'live',
    keywords: ['expenses', 'reimbursement', 'claims', 'spend'],
    params: [
      {
        kind: 'range',
        fromKey: 'from',
        toKey: 'to',
        label: 'Period',
        getFromDefault: () => daysAgoYmd(90),
        getToDefault: todayYmd,
      },
    ],
    endpoint: (v) => `/api/reports/expenses${qs(v, ['from', 'to'])}`,
  },
  {
    id: 'receivables',
    title: 'Receivables ageing',
    description: 'Outstanding customer invoices by ageing bucket and client.',
    module: 'accounts',
    category: 'finance',
    icon: 'CircleDollarSign',
    status: 'planned',
    keywords: ['invoices', 'ar', 'ageing', 'debtors', 'collections'],
  },
  {
    id: 'payables',
    title: 'Payables & vendor bills',
    description: 'Vendor bills due, ageing, and top suppliers by spend.',
    module: 'accounts',
    category: 'finance',
    icon: 'Wallet',
    status: 'planned',
    keywords: ['ap', 'vendors', 'bills', 'creditors', 'payments'],
  },

  // —— Procurement ——
  {
    id: 'procurement-spend',
    title: 'Procurement spend',
    description: 'Purchase requests, LPOs raised, and committed spend by category and vendor.',
    module: 'procurement',
    category: 'procurement',
    icon: 'ClipboardList',
    status: 'planned',
    keywords: ['purchase', 'lpo', 'po', 'requisition', 'vendor', 'spend'],
  },

  // —— Assets & operations ——
  {
    id: 'assets',
    title: 'Asset register',
    description: 'Assets by category and status, assignments, warranty, and maintenance due.',
    module: 'assets',
    category: 'operations',
    icon: 'Boxes',
    status: 'live',
    keywords: ['equipment', 'inventory', 'assignment', 'warranty', 'maintenance', 'depreciation'],
    endpoint: () => '/api/reports/assets',
  },

  // —— Health & safety ——
  {
    id: 'hse',
    title: 'HSE incident log',
    description: 'Incidents by severity, type, and status, with lost-time and reportable events.',
    module: 'hse',
    category: 'hse',
    icon: 'HardHat',
    status: 'live',
    keywords: ['safety', 'incident', 'injury', 'lti', 'near miss', 'environment'],
    params: [
      {
        kind: 'range',
        fromKey: 'from',
        toKey: 'to',
        label: 'Period',
        getFromDefault: () => daysAgoYmd(180),
        getToDefault: todayYmd,
      },
    ],
    endpoint: (v) => `/api/reports/hse${qs(v, ['from', 'to'])}`,
  },

  // —— Projects ——
  {
    id: 'project-portfolio',
    title: 'Project portfolio',
    description: 'Project status, milestones, and budget vs actual across the portfolio.',
    module: 'projects',
    category: 'projects',
    icon: 'FolderKanban',
    status: 'planned',
    keywords: ['project', 'deliverable', 'budget', 'milestone', 'gantt'],
  },

  // —— Performance ——
  {
    id: 'performance-cycle',
    title: 'Performance cycle',
    description: 'Review completion, rating distribution, and goal attainment by cycle.',
    module: 'performance',
    category: 'performance',
    icon: 'Gauge',
    status: 'planned',
    keywords: ['review', 'appraisal', 'rating', 'goals', 'kpi', 'scorecard'],
  },

  // —— Sales ——
  {
    id: 'sales-pipeline',
    title: 'Sales pipeline & attainment',
    description: 'Pipeline value by stage, target attainment, and commission accruals.',
    module: 'sales',
    category: 'sales',
    icon: 'TrendingUp',
    status: 'planned',
    keywords: ['deals', 'pipeline', 'target', 'quota', 'commission', 'forecast'],
  },

  // —— Fleet & logistics ——
  {
    id: 'fleet-utilisation',
    title: 'Fleet utilisation & compliance',
    description: 'Trips completed, vehicle utilisation, driving-time compliance, and client billing.',
    module: 'fleet',
    category: 'fleet',
    icon: 'Truck',
    status: 'planned',
    keywords: ['vehicles', 'trips', 'dispatch', 'telematics', 'settlement'],
  },

  // —— HR outsourcing ——
  {
    id: 'client-billing',
    title: 'Outsourcing client billing',
    description: 'Managed headcount, service fees, and billing by end client.',
    module: 'outsourcing',
    category: 'outsourcing',
    icon: 'Building2',
    status: 'planned',
    keywords: ['bpo', 'end client', 'billing', 'managed', 'rpo'],
  },

  // —— Legal & documents ——
  {
    id: 'documents-register',
    title: 'Policies & acknowledgements',
    description: 'Published policies, versions, and employee acknowledgement coverage.',
    module: 'documents',
    category: 'documents',
    icon: 'ScrollText',
    status: 'planned',
    keywords: ['policy', 'handbook', 'sop', 'acknowledgement'],
  },
  {
    id: 'contracts-obligations',
    title: 'Contracts & obligations',
    description: 'Contract renewals, obligations register, and expiry watchlist.',
    module: 'legal',
    category: 'documents',
    icon: 'FileText',
    status: 'planned',
    keywords: ['contract', 'obligation', 'renewal', 'legal'],
  },

  // —— Industry verticals ——
  {
    id: 'sacco-sasra',
    title: 'SACCO / SASRA returns',
    description: 'Member ledger, BOSA/FOSA balances, dividends, and SASRA reporting templates.',
    module: 'sacco',
    category: 'verticals',
    icon: 'PiggyBank',
    status: 'planned',
    keywords: ['sacco', 'sasra', 'member', 'dividend', 'bosa', 'fosa'],
  },
  {
    id: 'healthcare-compliance',
    title: 'Clinical compliance',
    description: 'Clinical rota coverage, licence gates on shifts, and NHIF/SHIF hooks.',
    module: 'healthcare',
    category: 'verticals',
    icon: 'Stethoscope',
    status: 'planned',
    keywords: ['clinical', 'nurse', 'roster', 'nhif', 'shif', 'licence'],
  },
];

// —— Tier helpers ——————————————————————————————————————————————————

export const TIER_ORDER: DeploymentTier[] = ['starter', 'growth', 'enterprise'];

const VERTICAL_MODULES: ModuleKey[] = [
  'fleet',
  'assets',
  'hse',
  'sacco',
  'healthcare',
  'energy',
  'construction',
];

export function tierRank(tier: DeploymentTier): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < 0 ? 0 : idx;
}

export function tierLabel(tier: DeploymentTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Earliest tier that entitles a module (via included modules or vertical engine access). */
export function minTierForModule(module: ModuleKey): DeploymentTier {
  for (const tier of TIER_ORDER) {
    const ent = MARKETING_TIER_ENTITLEMENTS[tier];
    if (ent.includedModules.includes(module)) return tier;
    if (ent.verticalEngines && VERTICAL_MODULES.includes(module)) return tier;
  }
  return 'enterprise';
}

export type ReportAccess = 'available' | 'coming-soon' | 'upgrade' | 'enable';

/**
 * Resolve how a report should render for the current tenant.
 * - `available`  — module enabled and endpoint live.
 * - `coming-soon`— module enabled but the report is still planned.
 * - `upgrade`    — the module needs a higher plan than the current tier.
 * - `enable`     — the module is in the plan but switched off (Company Setup / env).
 */
export function resolveReportAccess(
  report: ReportDefinition,
  enabledModules: Partial<Record<ModuleKey, boolean>>,
  tier: DeploymentTier,
): { access: ReportAccess; requiredTier: DeploymentTier } {
  const requiredTier = minTierForModule(report.module);
  const enabled = enabledModules[report.module] === true;

  if (enabled) {
    return { access: report.status === 'live' ? 'available' : 'coming-soon', requiredTier };
  }

  if (tierRank(requiredTier) > tierRank(tier)) {
    return { access: 'upgrade', requiredTier };
  }
  return { access: 'enable', requiredTier };
}

/** Default param values for a report (seeds the page's per-report control state). */
export function defaultParamValues(report: ReportDefinition): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of report.params ?? []) {
    if (param.kind === 'range') {
      values[param.fromKey] = param.getFromDefault();
      values[param.toKey] = param.getToDefault();
    } else {
      values[param.key] = param.getDefault();
    }
  }
  return values;
}
