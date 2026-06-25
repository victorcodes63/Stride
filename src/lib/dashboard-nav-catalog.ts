import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserSearch,
  FileText,
  Building2,
  Banknote,
  CalendarDays,
  Clock4,
  CalendarOff,
  FileSignature,
  BadgeCheck,
  ListTodo,
  Fingerprint,
  Receipt,
  Landmark,
  BarChart3,
  BarChart2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  UserCog,
  KeyRound,
  History,
  Settings,
  LayoutGrid,
  Wallet,
  FileStack,
  Scale,
  Package,
  ClipboardList,
  Smartphone,
  CalendarClock,
  FileQuestion,
  PieChart,
  Coins,
  Megaphone,
  GraduationCap,
  Network,
  FolderOpen,
  Truck,
  Route,
  ShoppingCart,
  Gavel,
} from 'lucide-react';
import type { UserRole } from '@/types/dashboard';
import { isDashboardNavItemVisible, isNavSectionVisible, type EnabledModulesMap } from '@/lib/nav-modules';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type DashboardNavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: DashboardNavItem[];
};

export type DashboardNavBuildOptions = {
  currentUserRole: UserRole | null;
  hasAccountsAccess: boolean;
  canViewSystemAnalytics: boolean;
  /** When false, hides Company setup from admin nav (Starter tier). */
  canAccessCompanySetup?: boolean;
  enabledModules?: EnabledModulesMap;
};

export const OVERVIEW_NAV_ITEM: DashboardNavItem = {
  href: '/dashboard',
  label: 'Overview',
  icon: LayoutDashboard,
};

const primarySections: DashboardNavSection[] = [
  {
    id: 'people-hr',
    label: 'People',
    icon: Users,
    items: [
      { href: '/dashboard/employees', label: 'Employees', icon: Users },
      { href: '/dashboard/departments', label: 'Departments', icon: Building2 },
      { href: '/dashboard/onboarding', label: 'Onboarding', icon: ListTodo },
      { href: '/dashboard/performance', label: 'Performance', icon: BarChart2 },
      { href: '/dashboard/disciplinary', label: 'Disciplinary', icon: Shield },
    ],
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    icon: Briefcase,
    items: [
      { href: '/dashboard/jobs', label: 'Job openings', icon: Briefcase },
      { href: '/dashboard/applications', label: 'Applications', icon: FileText },
      { href: '/dashboard/assessments', label: 'Assessments', icon: FileQuestion },
      { href: '/dashboard/candidates', label: 'Talent pool', icon: UserSearch },
      { href: '/dashboard/interviews', label: 'Interviews', icon: CalendarDays },
      { href: '/dashboard/interviews/schedule', label: 'Interview calendar', icon: Clock4 },
    ],
  },
  {
    id: 'time-attendance',
    label: 'Time & Attendance',
    icon: CalendarDays,
    items: [
      { href: '/dashboard/rota', label: 'Rota & scheduling', icon: CalendarDays },
      { href: '/dashboard/attendance', label: 'Attendance', icon: Clock4 },
      { href: '/dashboard/leave', label: 'Leave', icon: CalendarOff },
      { href: '/dashboard/biometric-devices', label: 'Biometric devices', icon: Fingerprint },
    ],
  },
];

const payrollSection: DashboardNavSection = {
  id: 'payroll',
  label: 'Payroll',
  icon: Banknote,
  items: [
    { href: '/dashboard/payroll', label: 'Payroll runs', icon: Banknote },
    { href: '/dashboard/payroll/payslips', label: 'Payslips', icon: Receipt },
    { href: '/dashboard/payroll/statutory', label: 'Statutory', icon: Landmark },
    { href: '/dashboard/payroll/disbursements', label: 'M-Pesa & disbursements', icon: Smartphone },
  ],
};

const procurementSection: DashboardNavSection = {
  id: 'procurement',
  label: 'Procurement',
  icon: ShoppingCart,
  items: [
    { href: '/dashboard/procurement', label: 'Overview', icon: LayoutGrid },
    { href: '/dashboard/procurement/purchase-requests', label: 'Purchase requests', icon: ClipboardList },
    { href: '/dashboard/procurement/lpos', label: 'LPO register', icon: FileSignature },
    { href: '/dashboard/procurement/spend', label: 'Spend dashboard', icon: Scale },
  ],
};

const legalDocumentsSection: DashboardNavSection = {
  id: 'legal-documents',
  label: 'Legal & Documents',
  icon: Gavel,
  items: [
    { href: '/dashboard/legal', label: 'Compliance hub', icon: Gavel },
    { href: '/dashboard/people/contracts', label: 'Contracts', icon: FileSignature },
    { href: '/dashboard/credentials', label: 'Credentials', icon: BadgeCheck },
    { href: '/dashboard/company-documents', label: 'Company policies', icon: FolderOpen },
    { href: '/dashboard/legal/obligations', label: 'Obligations register', icon: Scale },
  ],
};

const projectsSection: DashboardNavSection = {
  id: 'projects',
  label: 'Projects',
  icon: Briefcase,
  items: [
    { href: '/dashboard/projects', label: 'Overview', icon: LayoutGrid },
    { href: '/dashboard/projects/board', label: 'Project board', icon: Briefcase },
    { href: '/dashboard/projects/tasks', label: 'Tasks & deliverables', icon: ListTodo },
  ],
};

const fleetNavItems: DashboardNavItem[] = [
  { href: '/dashboard/fleet', label: 'Fleet', icon: Truck },
  { href: '/dashboard/fleet/trips', label: 'Trip board', icon: Route },
  { href: '/dashboard/fleet/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/dashboard/fleet/settlements', label: 'Settlements', icon: ClipboardList },
  { href: '/dashboard/fleet/billing', label: 'Billing', icon: Receipt },
  { href: '/dashboard/fleet/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/dashboard/fleet/vehicles', label: 'Vehicles', icon: Truck },
];

const assetsNavItems: DashboardNavItem[] = [
  { href: '/dashboard/assets', label: 'All assets', icon: Package },
  { href: '/dashboard/assets?assigned=1', label: 'Assignments', icon: ClipboardList },
];

const hseNavItems: DashboardNavItem[] = [
  { href: '/dashboard/hse', label: 'Incidents', icon: ShieldAlert },
];

/** Fleet, assets, and HSE — grouped for Admin & Operations sidebar. */
const operationsSection: DashboardNavSection = {
  id: 'operations',
  label: 'Operations',
  icon: Truck,
  items: [...fleetNavItems, ...assetsNavItems, ...hseNavItems],
};

const essSelfServiceSection: DashboardNavSection = {
  id: 'employee-self-service',
  label: 'Employee self-service',
  icon: Smartphone,
  items: [
    { href: '/dashboard/ess/portal-accounts', label: 'Portal accounts', icon: UserCog },
    { href: '/dashboard/ess/shifts', label: 'ESS & shifts', icon: CalendarClock },
    { href: '/dashboard/ess/document-requests', label: 'Document requests', icon: FileQuestion },
  ],
};

const adminSection: DashboardNavSection = {
  id: 'admin',
  label: 'Administration',
  icon: Shield,
  items: [
    { href: '/dashboard/admin/company-setup', label: 'Company setup', icon: Building2 },
    { href: '/dashboard/users/staff', label: 'System users', icon: Shield },
    { href: '/dashboard/admin/roles-permissions', label: 'Roles & permissions', icon: KeyRound },
    { href: '/dashboard/admin/holidays', label: 'Public holidays', icon: CalendarDays },
    { href: '/dashboard/admin/facilities', label: 'Facilities', icon: Building2 },
    { href: '/dashboard/admin/governance', label: 'Board & governance', icon: Landmark },
    { href: '/dashboard/admin/audit-log', label: 'Audit log', icon: History },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ],
};

const financeSection: DashboardNavSection = {
  id: 'finance',
  label: 'Finance',
  icon: Landmark,
  items: [
    { href: '/dashboard/accounts', label: 'Overview', icon: LayoutGrid },
    { href: '/dashboard/accounts/clients', label: 'Clients', icon: Building2 },
    { href: '/dashboard/accounts/invoices', label: 'Invoices', icon: FileText },
    { href: '/dashboard/accounts/receipts', label: 'Receipts & allocations', icon: Receipt },
    { href: '/dashboard/accounts/payment-accounts', label: 'Payment accounts', icon: Banknote },
    { href: '/dashboard/accounts/vendors', label: 'Vendors', icon: Wallet },
    { href: '/dashboard/accounts/vendor-bills', label: 'Vendor bills', icon: FileStack },
    { href: '/dashboard/accounts/expenses', label: 'Expense claims', icon: Receipt },
    { href: '/dashboard/accounts/statements', label: 'Statements', icon: Scale },
    { href: '/dashboard/accounts/budgets', label: 'Budgets', icon: PieChart },
    { href: '/dashboard/accounts/petty-cash', label: 'Petty cash', icon: Coins },
    { href: '/dashboard/accounts/financial-reports', label: 'Financial reports', icon: BarChart3 },
  ],
};

const developmentSection: DashboardNavSection = {
  id: 'development',
  label: 'Development',
  icon: GraduationCap,
  items: [
    { href: '/dashboard/training', label: 'Training programs', icon: GraduationCap },
    { href: '/dashboard/org-chart', label: 'Org chart', icon: Network },
  ],
};

function buildCommunicationsInsightSection(canViewSystemAnalytics: boolean): DashboardNavSection {
  const items: DashboardNavItem[] = [
    { href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/dashboard/reports', label: 'All reports', icon: BarChart3 },
  ];
  if (canViewSystemAnalytics) {
    items.push({ href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 });
  }
  return {
    id: 'communications-insight',
    label: 'Communications & reports',
    icon: Megaphone,
    items,
  };
}

/** Roadmap sections — always visible so partial/planned modules stay discoverable. */
const ROADMAP_NAV_SECTION_IDS = new Set(['procurement', 'projects', 'legal-documents']);

function filterSections(
  sections: DashboardNavSection[],
  enabled: EnabledModulesMap,
  options: DashboardNavBuildOptions,
): DashboardNavSection[] {
  return sections
    .filter((section) => {
      if (ROADMAP_NAV_SECTION_IDS.has(section.id)) return true;
      if (section.id === 'finance') {
        return isNavSectionVisible(section.id, enabled);
      }
      if (section.id === 'admin') {
        return (
          options.currentUserRole === 'admin' ||
          options.hasAccountsAccess ||
          options.canViewSystemAnalytics
        );
      }
      return isNavSectionVisible(section.id, enabled);
    })
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.href === '/dashboard/analytics') return options.canViewSystemAnalytics;
        if (item.href === '/dashboard/admin/company-setup') {
          return options.canAccessCompanySetup === true;
        }
        return isDashboardNavItemVisible(item.href, section.id, enabled);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function buildDashboardNavSections(options: DashboardNavBuildOptions): DashboardNavSection[] {
  const enabledModules = options.enabledModules ?? ALL_MODULES_ENABLED;
  const resolvedOptions = { ...options, enabledModules };
  const chunks: DashboardNavSection[] = [
    ...primarySections,
    payrollSection,
    developmentSection,
    essSelfServiceSection,
  ];
  if (isNavSectionVisible('finance', enabledModules)) {
    chunks.push(financeSection);
  }
  chunks.push(procurementSection, legalDocumentsSection, projectsSection);
  chunks.push(
    operationsSection,
    buildCommunicationsInsightSection(options.canViewSystemAnalytics),
  );
  if (
    options.currentUserRole === 'admin' ||
    options.hasAccountsAccess ||
    options.canViewSystemAnalytics
  ) {
    chunks.push(adminSection);
  }
  return filterSections(chunks, enabledModules, resolvedOptions);
}

export function flattenDashboardNavItems(
  sections: DashboardNavSection[],
  includeOverview = true,
): DashboardNavItem[] {
  const items: DashboardNavItem[] = includeOverview ? [OVERVIEW_NAV_ITEM] : [];
  for (const section of sections) {
    for (const item of section.items) {
      items.push(item);
    }
  }
  return items;
}

export function resolveDashboardNavItems(
  hrefs: string[],
  sections: DashboardNavSection[],
  includeOverview = true,
): DashboardNavItem[] {
  const catalog = new Map(
    flattenDashboardNavItems(sections, includeOverview).map((item) => [item.href, item]),
  );
  return hrefs.map((href) => catalog.get(href)).filter((item): item is DashboardNavItem => Boolean(item));
}

export const ALL_MODULES_ENABLED = {
  core: true,
  leave: true,
  time: true,
  payroll: true,
  ats: true,
  performance: true,
  hse: true,
  accounts: true,
  disciplinary: true,
  reports: true,
  assets: true,
  fleet: true,
  ess: true,
  communications: true,
  training: true,
  documents: true,
} satisfies EnabledModulesMap;

export const DASHBOARD_NAV_EXPANDABLE_SECTION_IDS = [
  ...primarySections.map((s) => s.id),
  payrollSection.id,
  developmentSection.id,
  essSelfServiceSection.id,
  financeSection.id,
  procurementSection.id,
  legalDocumentsSection.id,
  projectsSection.id,
  operationsSection.id,
  'communications-insight',
  adminSection.id,
];

/** Sidebar group headers — aligned with public marketing six core modules. */
export const DASHBOARD_NAV_GROUPS = [
  { label: '01 — HR & Payroll', startSectionId: 'people-hr' },
  { label: '02 — Finance', startSectionId: 'finance' },
  { label: '03 — Procurement', startSectionId: 'procurement' },
  { label: '04 — Legal & Documents', startSectionId: 'legal-documents' },
  { label: '05 — Projects', startSectionId: 'projects' },
  { label: '06 — Admin & Operations', startSectionId: 'operations' },
] as const;

/** @deprecated Use DASHBOARD_NAV_GROUPS */
export const DASHBOARD_NAV_GROUP_STARTS = DASHBOARD_NAV_GROUPS.map((g) => g.startSectionId);
