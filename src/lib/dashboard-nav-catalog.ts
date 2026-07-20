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
  Stethoscope,
  Fuel,
  HardHat,
  MapPin,
  Radio,
  Wrench,
  Leaf,
  Bell,
  UserCheck,
  TrendingUp,
  Handshake,
  Target,
  Palette,
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
      { href: '/dashboard/people/tasks', label: 'Tasks', icon: ListTodo },
      { href: '/dashboard/onboarding', label: 'Onboarding', icon: ClipboardList },
      { href: '/dashboard/onboarding/analytics', label: 'Onboarding analytics', icon: BarChart2 },
      { href: '/dashboard/performance', label: 'Performance', icon: BarChart2 },
      { href: '/dashboard/performance/jds', label: 'Job descriptions', icon: BarChart2 },
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
      { href: '/dashboard/staff-leave', label: 'Leave', icon: CalendarOff },
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
    { href: '/dashboard/procurement/receiving', label: 'Receiving', icon: Package },
    { href: '/dashboard/procurement/vendors', label: 'Vendors', icon: Building2 },
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
    { href: '/dashboard/legal/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/dashboard/legal/calendar', label: 'Calendar', icon: CalendarClock },
  ],
};

const projectsSection: DashboardNavSection = {
  id: 'projects',
  label: 'Projects',
  icon: Briefcase,
  items: [
    { href: '/dashboard/projects', label: 'Overview', icon: LayoutGrid },
    { href: '/dashboard/projects/all', label: 'All projects', icon: Briefcase },
    { href: '/dashboard/projects/board', label: 'Project board', icon: Briefcase },
    { href: '/dashboard/projects/tasks', label: 'Tasks & deliverables', icon: ListTodo },
    { href: '/dashboard/projects/budget', label: 'Budget vs actual', icon: Scale },
  ],
};

const fleetOperationsSection: DashboardNavSection = {
  id: 'fleet-operations',
  label: 'Orders & dispatch',
  icon: Route,
  items: [
    { href: '/dashboard/fleet', label: 'Overview', icon: LayoutGrid },
    { href: '/dashboard/fleet/orders', label: 'Transport orders', icon: ClipboardList },
    { href: '/dashboard/fleet/customers', label: 'Customers', icon: Building2 },
    { href: '/dashboard/fleet/planning', label: 'Route planning', icon: MapPin },
    { href: '/dashboard/fleet/trips', label: 'Trip board', icon: Route },
    { href: '/dashboard/fleet/compliance', label: 'Pre-trip compliance', icon: ShieldCheck },
  ],
};

const fleetMonitoringSection: DashboardNavSection = {
  id: 'fleet-monitoring',
  label: 'Monitoring',
  icon: Radio,
  items: [
    { href: '/dashboard/fleet/tracking', label: 'Live tracking', icon: Radio },
    { href: '/dashboard/fleet/geofences', label: 'Geofences', icon: MapPin },
    { href: '/dashboard/fleet/driving-time', label: 'Driving time', icon: Clock4 },
    { href: '/dashboard/fleet/incidents', label: 'Incidents', icon: AlertTriangle },
    { href: '/dashboard/fleet/alarms', label: 'Events & alarms', icon: Bell },
  ],
};

const fleetAssetsSection: DashboardNavSection = {
  id: 'fleet-assets',
  label: 'Fleet assets',
  icon: Truck,
  items: [
    { href: '/dashboard/fleet/vehicles', label: 'Vehicles', icon: Truck },
    { href: '/dashboard/fleet/service', label: 'Service planning', icon: Wrench },
    { href: '/dashboard/fleet/defects', label: 'Defect reports', icon: AlertTriangle },
    { href: '/dashboard/fleet/registers', label: 'Registers', icon: ClipboardList },
  ],
};

const fleetCommercialSection: DashboardNavSection = {
  id: 'fleet-commercial',
  label: 'Commercial',
  icon: Receipt,
  items: [
    { href: '/dashboard/fleet/settlements', label: 'Settlements', icon: Wallet },
    { href: '/dashboard/fleet/billing', label: 'Client billing', icon: Receipt },
    { href: '/dashboard/fleet/drivers/performance', label: 'Driver performance', icon: UserCheck },
    { href: '/dashboard/fleet/environmental', label: 'Environmental', icon: Leaf },
    { href: '/dashboard/fleet/reports', label: 'Performance reports', icon: BarChart2 },
  ],
};

const outsourcingClientsSection: DashboardNavSection = {
  id: 'outsourcing-clients',
  label: 'End clients',
  icon: Handshake,
  items: [
    { href: '/dashboard/outsourcing', label: 'Overview', icon: LayoutGrid },
    { href: '/dashboard/outsourcing/clients', label: 'Client register', icon: Building2 },
  ],
};

const outsourcingWorkforceSection: DashboardNavSection = {
  id: 'outsourcing-workforce',
  label: 'Workforce',
  icon: Users,
  items: [
    { href: '/dashboard/outsourcing/employees', label: 'Outsourced employees', icon: Users },
    { href: '/dashboard/outsourcing/departments', label: 'Departments', icon: Building2 },
  ],
};

const outsourcingServicesSection: DashboardNavSection = {
  id: 'outsourcing-services',
  label: 'Client services',
  icon: Briefcase,
  items: [
    { href: '/dashboard/outsourcing/payroll', label: 'Payroll', icon: Banknote },
    { href: '/dashboard/outsourcing/attendance', label: 'Time & attendance', icon: Clock4 },
    { href: '/dashboard/outsourcing/rota', label: 'Rota', icon: CalendarClock },
    { href: '/dashboard/outsourcing/biometrics', label: 'Biometrics', icon: Fingerprint },
    { href: '/dashboard/outsourcing/leave', label: 'Leave', icon: CalendarOff },
    { href: '/dashboard/outsourcing/disciplinary', label: 'Disciplinary', icon: Shield },
    { href: '/dashboard/outsourcing/jobs', label: 'Recruitment (RPO)', icon: Briefcase },
    { href: '/dashboard/outsourcing/billing', label: 'Billing', icon: Receipt },
    { href: '/dashboard/outsourcing/reports', label: 'Reports', icon: FileText },
  ],
};

const salesSection: DashboardNavSection = {
  id: 'sales',
  label: 'Sales',
  icon: TrendingUp,
  items: [
    { href: '/dashboard/sales', label: 'Sales performance', icon: TrendingUp },
    { href: '/dashboard/sales/targets', label: 'Sales targets', icon: Target },
    { href: '/dashboard/sales/deals', label: 'Pipeline', icon: Handshake },
    { href: '/dashboard/sales/leads', label: 'Leads', icon: UserSearch },
    { href: '/dashboard/sales/tasks', label: 'Tasks', icon: ListTodo },
    { href: '/dashboard/sales/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/sales/products', label: 'Products', icon: Package },
    { href: '/dashboard/sales/quotes', label: 'Quotes', icon: FileText },
    { href: '/dashboard/sales/forecast', label: 'Forecast', icon: PieChart },
    { href: '/dashboard/sales/attainment', label: 'Attainment', icon: TrendingUp },
    { href: '/dashboard/sales/commissions', label: 'Commissions', icon: Coins },
  ],
};

const assetsNavItems: DashboardNavItem[] = [
  { href: '/dashboard/assets', label: 'All assets', icon: Package },
  { href: '/dashboard/assets?assigned=1', label: 'Assignments', icon: ClipboardList },
];

const hseNavItems: DashboardNavItem[] = [
  { href: '/dashboard/hse', label: 'Incidents', icon: ShieldAlert },
];

const saccoNavItems: DashboardNavItem[] = [
  { href: '/dashboard/sacco', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/sacco/members', label: 'Members', icon: Users },
  { href: '/dashboard/sacco/accounts', label: 'BOSA & FOSA', icon: Wallet },
  { href: '/dashboard/sacco/dividends', label: 'Dividends', icon: Banknote },
  { href: '/dashboard/sacco/reports', label: 'SASRA reports', icon: FileText },
];

/** Assets and HSE — admin operations sidebar (fleet is its own module). */
const operationsSection: DashboardNavSection = {
  id: 'operations',
  label: 'Operations',
  icon: Package,
  items: [...assetsNavItems, ...hseNavItems],
};

const saccoSection: DashboardNavSection = {
  id: 'sacco',
  label: 'SACCO',
  icon: Landmark,
  items: saccoNavItems,
};

const healthcareNavItems: DashboardNavItem[] = [
  { href: '/dashboard/healthcare', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/healthcare/wards', label: 'Wards & rules', icon: Building2 },
  { href: '/dashboard/healthcare/rota', label: 'Clinical rota', icon: CalendarDays },
  { href: '/dashboard/healthcare/nhif', label: 'NHIF / SHIF', icon: BadgeCheck },
];

const healthcareSection: DashboardNavSection = {
  id: 'healthcare',
  label: 'Healthcare',
  icon: Stethoscope,
  items: healthcareNavItems,
};

const energyNavItems: DashboardNavItem[] = [
  { href: '/dashboard/energy', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/energy/sites', label: 'Sites', icon: Building2 },
  { href: '/dashboard/energy/permits', label: 'Permits', icon: FileSignature },
  { href: '/dashboard/energy/hse', label: 'HSE rollup', icon: ShieldAlert },
];

const energySection: DashboardNavSection = {
  id: 'energy',
  label: 'Energy',
  icon: Fuel,
  items: energyNavItems,
};

const constructionNavItems: DashboardNavItem[] = [
  { href: '/dashboard/construction', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/construction/sites', label: 'Sites', icon: Building2 },
  { href: '/dashboard/construction/plant', label: 'Plant assets', icon: Truck },
  { href: '/dashboard/construction/subcontractors', label: 'Subcontractors', icon: Briefcase },
];

const constructionSection: DashboardNavSection = {
  id: 'construction',
  label: 'Construction',
  icon: HardHat,
  items: constructionNavItems,
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
    { href: '/dashboard/admin/branding', label: 'Branding & white-label', icon: Palette },
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
    { href: '/dashboard/accounts/invoicing-setup', label: 'Invoicing setup', icon: FileSignature },
    { href: '/dashboard/accounts/receipts', label: 'Receipts & allocations', icon: Receipt },
    { href: '/dashboard/accounts/mpesa-reconciliation', label: 'M-Pesa reconciliation', icon: Smartphone },
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

/** Sections gated by subscription entitlements like any other module. */
const ROADMAP_NAV_SECTION_IDS = new Set<string>();

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
        if (
          item.href === '/dashboard/admin/company-setup' ||
          item.href === '/dashboard/admin/branding'
        ) {
          return options.currentUserRole === 'admin';
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
  if (isNavSectionVisible('sacco', enabledModules)) {
    chunks.push(saccoSection);
  }
  if (isNavSectionVisible('healthcare', enabledModules)) {
    chunks.push(healthcareSection);
  }
  if (isNavSectionVisible('energy', enabledModules)) {
    chunks.push(energySection);
  }
  if (isNavSectionVisible('construction', enabledModules)) {
    chunks.push(constructionSection);
  }
  if (isNavSectionVisible('fleet-operations', enabledModules)) {
    chunks.push(
      fleetOperationsSection,
      fleetMonitoringSection,
      fleetAssetsSection,
      fleetCommercialSection,
    );
  }
  if (isNavSectionVisible('outsourcing-clients', enabledModules)) {
    chunks.push(
      outsourcingClientsSection,
      outsourcingWorkforceSection,
      outsourcingServicesSection,
    );
  }
  if (isNavSectionVisible('sales', enabledModules)) {
    chunks.push(salesSection);
  }
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

/** Unfiltered nav sections for static href→module maps (MOD-02 audit — no visibility resolver). */
export function getStaticNavCatalogSections(): DashboardNavSection[] {
  return [
    ...primarySections,
    payrollSection,
    developmentSection,
    essSelfServiceSection,
    financeSection,
    procurementSection,
    legalDocumentsSection,
    projectsSection,
    saccoSection,
    healthcareSection,
    energySection,
    constructionSection,
    fleetOperationsSection,
    fleetMonitoringSection,
    fleetAssetsSection,
    fleetCommercialSection,
    outsourcingClientsSection,
    outsourcingWorkforceSection,
    outsourcingServicesSection,
    salesSection,
    operationsSection,
    buildCommunicationsInsightSection(true),
    adminSection,
  ];
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
  sacco: true,
  healthcare: true,
  energy: true,
  construction: true,
  ess: true,
  communications: true,
  training: true,
  documents: true,
  procurement: true,
  legal: true,
  projects: true,
  operations: true,
  outsourcing: true,
  sales: true,
  assessments: true,
} satisfies EnabledModulesMap;

/** Full nav catalog with all modules enabled — for audits and static binding maps. */
export function getDashboardNavCatalogSections(): DashboardNavSection[] {
  return buildDashboardNavSections({
    currentUserRole: 'admin',
    hasAccountsAccess: true,
    canViewSystemAnalytics: true,
    canAccessCompanySetup: true,
    enabledModules: ALL_MODULES_ENABLED,
  });
}

export const DASHBOARD_NAV_EXPANDABLE_SECTION_IDS = [
  ...primarySections.map((s) => s.id),
  payrollSection.id,
  developmentSection.id,
  essSelfServiceSection.id,
  financeSection.id,
  procurementSection.id,
  legalDocumentsSection.id,
  projectsSection.id,
  saccoSection.id,
  healthcareSection.id,
  energySection.id,
  constructionSection.id,
  fleetOperationsSection.id,
  fleetMonitoringSection.id,
  fleetAssetsSection.id,
  fleetCommercialSection.id,
  outsourcingClientsSection.id,
  outsourcingWorkforceSection.id,
  outsourcingServicesSection.id,
  salesSection.id,
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
  { label: '06 — Fleet management', startSectionId: 'fleet-operations' },
  { label: '09 — HR Outsourcing', startSectionId: 'outsourcing-clients' },
  { label: '10 — Sales', startSectionId: 'sales' },
  { label: '07 — Operations', startSectionId: 'operations' },
  { label: '08 — Platform admin', startSectionId: 'admin' },
] as const;

/** @deprecated Use DASHBOARD_NAV_GROUPS */
export const DASHBOARD_NAV_GROUP_STARTS = DASHBOARD_NAV_GROUPS.map((g) => g.startSectionId);
