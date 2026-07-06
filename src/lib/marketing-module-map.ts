/**
 * MKT-01 / MKT-02 — Marketing module map derived from module-registry.ts.
 * Every ModuleKey maps to exactly one visible marketing area; labels and readiness are honest.
 */

import {
  getModuleRegistryEntry,
  MODULE_KEYS,
  type ModuleKey,
} from '@/lib/module-registry';

export type MarketingModuleReadiness = 'live' | 'partial' | 'roadmap';

export type MarketingAreaId =
  | 'hr-payroll'
  | 'finance'
  | 'procurement'
  | 'legal-documents'
  | 'projects'
  | 'admin-operations'
  | 'fleet-logistics'
  | 'hr-outsourcing'
  | 'sales';

/** Product-area module assignment — source of truth for MKT-01 (no module lost in "Admin"). */
export const MARKETING_AREA_MODULE_KEYS: Record<MarketingAreaId, readonly ModuleKey[]> = {
  'hr-payroll': [
    'core',
    'leave',
    'time',
    'payroll',
    'disciplinary',
    'ess',
    'ats',
    'assessments',
    'performance',
    'training',
    'reports',
    'communications',
  ],
  finance: ['accounts'],
  procurement: ['procurement'],
  'legal-documents': ['legal', 'documents'],
  projects: ['projects'],
  'admin-operations': ['assets', 'hse', 'operations'],
  'fleet-logistics': ['fleet'],
  'hr-outsourcing': ['outsourcing'],
  sales: ['sales'],
};

/** Industry-pack module keys (vertical engines marketed separately from product areas). */
export const INDUSTRY_PACK_MODULE_KEYS = [
  'fleet',
  'sacco',
  'healthcare',
  'energy',
  'construction',
] as const satisfies readonly ModuleKey[];

export type IndustryPackModuleKey = (typeof INDUSTRY_PACK_MODULE_KEYS)[number];

/** Honest per-module readiness — ties to build/migration status (RAV-120). */
export const MARKETING_MODULE_READINESS: Record<ModuleKey, MarketingModuleReadiness> = {
  core: 'live',
  ess: 'live',
  leave: 'live',
  time: 'live',
  payroll: 'live',
  disciplinary: 'live',
  accounts: 'partial',
  reports: 'live',
  documents: 'partial',
  communications: 'live',
  ats: 'live',
  assessments: 'partial',
  performance: 'live',
  training: 'live',
  procurement: 'partial',
  legal: 'partial',
  projects: 'roadmap',
  operations: 'partial',
  outsourcing: 'partial',
  sales: 'roadmap',
  fleet: 'live',
  assets: 'partial',
  hse: 'live',
  sacco: 'roadmap',
  healthcare: 'roadmap',
  energy: 'roadmap',
  construction: 'roadmap',
};

export type MarketingModuleChip = {
  key: ModuleKey;
  label: string;
  readiness: MarketingModuleReadiness;
};

export type MarketingProductArea = {
  id: MarketingAreaId;
  num: string;
  name: string;
  readiness: MarketingModuleReadiness;
  headline: string;
  description: string;
  features: string[];
  modules: MarketingModuleChip[];
};

function marketingModuleLabel(key: ModuleKey): string {
  const entry = getModuleRegistryEntry(key);
  if (key === 'ats') return 'Recruitment & Talent';
  if (key === 'accounts') return 'Finance';
  return entry.label;
}

function chipsForKeys(keys: readonly ModuleKey[]): MarketingModuleChip[] {
  return keys.map((key) => ({
    key,
    label: marketingModuleLabel(key),
    readiness: MARKETING_MODULE_READINESS[key],
  }));
}

/** Area readiness = least mature module in the area (honest aggregate badge). */
function areaReadiness(keys: readonly ModuleKey[]): MarketingModuleReadiness {
  const order: MarketingModuleReadiness[] = ['roadmap', 'partial', 'live'];
  let worst: MarketingModuleReadiness = 'live';
  for (const key of keys) {
    const r = MARKETING_MODULE_READINESS[key];
    if (order.indexOf(r) < order.indexOf(worst)) worst = r;
  }
  return worst;
}

const MARKETING_AREA_COPY: Record<
  MarketingAreaId,
  Pick<MarketingProductArea, 'headline' | 'description' | 'features'>
> = {
  'hr-payroll': {
    headline: 'Pay people correctly. Hire and develop them on the same records.',
    description:
      'People, leave, time, payroll, disciplinary, ESS, recruitment, assessments, performance, training, reports and communications — on one employee graph with KRA, NSSF and SHIF built in.',
    features: [
      'Employee directory, org chart, onboarding and tasks',
      'Leave, rota, attendance and biometric clock-in',
      'Payroll runs, payslips, statutory and M-Pesa disbursements',
      'Recruitment & Talent — jobs, pipeline, interviews and careers site',
      'AssessIQ candidate assessments linked to applications',
      'Performance cycles, scorecards and review workflows',
    ],
  },
  finance: {
    headline: 'One ledger for how money actually moves.',
    description:
      'Invoicing, vendor bills, expenses, petty cash, budgets and financial reports on the same chart of accounts payroll posts to. Core AR/AP is live; advanced statements and billing automation are still rolling out.',
    features: [
      'Client and vendor registers',
      'Invoices, receipts and aged debtors',
      'Expense claims and approval chains',
      'Budgets and management reports',
      'M-Pesa reconciliation against collections',
    ],
  },
  procurement: {
    headline: 'Structured spend from request to payment.',
    description:
      'Purchase requests, vendor spend and approval workflows are live. LPO generation, goods received notes and three-way match into finance are on the roadmap.',
    features: [
      'Purchase requests with multi-level approvals',
      'LPO register and spend dashboard',
      'Vendor rate cards',
      'Department and project spend tracking',
    ],
  },
  'legal-documents': {
    headline: 'Contracts, credentials and policies in one place.',
    description:
      'Legal obligations register, employee credentials and company policy library — core registers are usable; unified compliance hub and renewal automation are still maturing.',
    features: [
      'Contracts linked to employees and clients',
      'Credential expiry tracking',
      'Company policies and SOP library',
      'Obligations register with audit trail',
    ],
  },
  projects: {
    headline: 'Deliverables tied to real people and budgets.',
    description:
      'Project register, kanban board, tasks and budget vs actual — workspaces exist but full delivery tracking is not GA yet.',
    features: [
      'Project register and milestone tracking',
      'Kanban board and task assignment',
      'Budget vs actual against finance',
      'Client billing hooks into invoicing',
    ],
  },
  'admin-operations': {
    headline: 'Assets, HSE and operational reporting — not a junk drawer.',
    description:
      'Company asset registry, HSE incident tracking, announcements and workforce analytics. The operations hub ties assets and safety together; advanced facilities workflows are still maturing.',
    features: [
      'Asset register with assignments and lifecycle',
      'HSE incident logging and actions',
      'Announcements and internal comms',
      'Workforce reports and analytics',
    ],
  },
  'fleet-logistics': {
    headline: 'Transport orders through to client billing.',
    description:
      'Fleet & Logistics is live for Kenya road freight — transport orders, trip dispatch, compliance, settlements and client billing on the same finance module as payroll.',
    features: [
      'Transport orders and trip board',
      'Vehicle and driver registers',
      'Live tracking, geofences and compliance gates',
      'Settlements and client billing',
    ],
  },
  'hr-outsourcing': {
    headline: 'Per-client payroll and workforce for BPO operators.',
    description:
      'End-client register, outsourced workforce, and per-client payroll, attendance, leave and disciplinary — built for boutique HR firms and outsourcing operators.',
    features: [
      'End-client register with entity codes',
      'Outsourced employee and department management',
      'Per-client payroll runs and payslips',
      'Client-scoped attendance and leave',
    ],
  },
  sales: {
    headline: 'Pipeline KPIs on the same scorecards as performance.',
    description:
      'Sales pipeline attainment auto-measures for revenue roles via performance scorecards. Full CRM and pipeline UI are on the roadmap — today the KPI layer is live for reviews.',
    features: [
      'Pipeline attainment KPI provider',
      'Scorecard auto-measures for sales roles',
      'Tied to performance review cycles',
    ],
  },
};

const MARKETING_AREA_ORDER: MarketingAreaId[] = [
  'hr-payroll',
  'finance',
  'procurement',
  'legal-documents',
  'projects',
  'admin-operations',
  'fleet-logistics',
  'hr-outsourcing',
  'sales',
];

const MARKETING_AREA_NUMBERS: Record<MarketingAreaId, string> = {
  'hr-payroll': '01',
  finance: '02',
  procurement: '03',
  'legal-documents': '04',
  projects: '05',
  'admin-operations': '06',
  'fleet-logistics': '07',
  'hr-outsourcing': '08',
  sales: '09',
};

const MARKETING_AREA_NAMES: Record<MarketingAreaId, string> = {
  'hr-payroll': 'HR & Payroll',
  finance: 'Finance',
  procurement: 'Procurement',
  'legal-documents': 'Legal & Documents',
  projects: 'Projects',
  'admin-operations': 'Admin & Operations',
  'fleet-logistics': 'Fleet & Logistics',
  'hr-outsourcing': 'HR Outsourcing',
  sales: 'Sales',
};

/** Nine product areas with module chips — homepage and /platform source. */
export function buildMarketingProductAreas(): MarketingProductArea[] {
  return MARKETING_AREA_ORDER.map((id) => {
    const keys = MARKETING_AREA_MODULE_KEYS[id];
    const copy = MARKETING_AREA_COPY[id];
    return {
      id,
      num: MARKETING_AREA_NUMBERS[id],
      name: MARKETING_AREA_NAMES[id],
      readiness: areaReadiness(keys),
      modules: chipsForKeys(keys),
      ...copy,
    };
  });
}

export const MARKETING_PRODUCT_AREAS = buildMarketingProductAreas();

/** Homepage card shape (subset of product areas). */
export function buildCoreModulesFromRegistry() {
  return MARKETING_PRODUCT_AREAS.map((area) => ({
    num: `${area.num} — ${area.name.split(' ')[0]}`,
    name: area.name,
    readiness: area.readiness,
    description: area.description,
    modules: area.modules,
  }));
}

/** Validate MKT-01: every ModuleKey appears in exactly one product area OR industry pack. */
export function validateMarketingModuleCoverage(): void {
  const assigned = new Map<ModuleKey, string>();
  for (const [areaId, keys] of Object.entries(MARKETING_AREA_MODULE_KEYS)) {
    for (const key of keys) {
      if (assigned.has(key)) {
        throw new Error(`Module ${key} assigned to both ${assigned.get(key)} and ${areaId}`);
      }
      assigned.set(key, areaId);
    }
  }
  for (const key of ['sacco', 'healthcare', 'energy', 'construction'] as const) {
    if (assigned.has(key)) {
      throw new Error(`Industry-pack module ${key} must not duplicate a product area`);
    }
    assigned.set(key, 'industry-packs');
  }
  if (!assigned.has('fleet')) {
    throw new Error('fleet must be assigned to fleet-logistics product area');
  }
  for (const key of MODULE_KEYS) {
    if (!assigned.has(key)) {
      throw new Error(`Module ${key} missing from marketing map`);
    }
  }
  if (assigned.size !== MODULE_KEYS.length) {
    throw new Error(`Expected ${MODULE_KEYS.length} modules, mapped ${assigned.size}`);
  }
}

validateMarketingModuleCoverage();
