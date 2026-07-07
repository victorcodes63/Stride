/**
 * Canonical Stride platform structure — product modules, subscription keys, and sub-modules.
 *
 * Three layers:
 * 1. **Product module** — top-level switcher domain (HR, Finance, Projects, …)
 * 2. **Subscription key** — control-plane entitlement toggle (`ModuleKey`)
 * 3. **Sub-module** — sidebar section/item (`dashboard-nav-catalog.ts`)
 *
 * Source of truth for nav items: `buildDashboardNavSections()` in dashboard-nav-catalog.
 * Source of truth for switcher domains: `DASHBOARD_MODULE_DOMAINS` in dashboard-module-domains.
 */

import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import type { ModuleKey } from '@/lib/modules';

export type StrideSubModule = {
  /** Nav section id in dashboard-nav-catalog */
  sectionId: string;
  label: string;
  /** Minimum subscription key for the section to appear */
  licenseKey: ModuleKey;
  items: { label: string; href: string }[];
};

export type StrideProductModule = {
  /** Matches DashboardModuleDomainId */
  id: DashboardModuleDomainId;
  label: string;
  marketingNumber: string;
  hubHref: string;
  /** How the switcher decides visibility */
  access: 'subscription' | 'role';
  /** Keys that unlock the product module in the switcher */
  switcherKeys: ModuleKey[];
  /** Human-readable subscription keys bundled in this product area */
  subscriptionKeys: ModuleKey[];
  subModules: StrideSubModule[];
};

/** Sidebar / switcher structure — keep in sync with dashboard-nav-catalog & module-routes. */
export const STRIDE_PRODUCT_MODULES: StrideProductModule[] = [
  {
    id: 'hr-payroll',
    label: 'HR & Payroll',
    marketingNumber: '01',
    hubHref: '/dashboard/people',
    access: 'subscription',
    switcherKeys: ['core'],
    subscriptionKeys: [
      'core',
      'leave',
      'time',
      'payroll',
      'ats',
      'performance',
      'disciplinary',
      'ess',
      'training',
      'reports',
    ],
    subModules: [
      {
        sectionId: 'people-hr',
        label: 'People',
        licenseKey: 'core',
        items: [
          { label: 'Employees', href: '/dashboard/employees' },
          { label: 'Departments', href: '/dashboard/departments' },
          { label: 'Tasks', href: '/dashboard/people/tasks' },
          { label: 'Onboarding', href: '/dashboard/onboarding' },
          { label: 'Performance', href: '/dashboard/performance' },
          { label: 'Disciplinary', href: '/dashboard/disciplinary' },
        ],
      },
      {
        sectionId: 'recruitment',
        label: 'Recruitment',
        licenseKey: 'ats',
        items: [
          { label: 'Job openings', href: '/dashboard/jobs' },
          { label: 'Applications', href: '/dashboard/applications' },
          { label: 'Assessments', href: '/dashboard/assessments' },
          { label: 'Talent pool', href: '/dashboard/candidates' },
          { label: 'Interviews', href: '/dashboard/interviews' },
        ],
      },
      {
        sectionId: 'time-attendance',
        label: 'Time & Attendance',
        licenseKey: 'time',
        items: [
          { label: 'Rota & scheduling', href: '/dashboard/rota' },
          { label: 'Attendance', href: '/dashboard/attendance' },
          { label: 'Leave', href: '/dashboard/leave' },
          { label: 'Biometric devices', href: '/dashboard/biometric-devices' },
        ],
      },
      {
        sectionId: 'payroll',
        label: 'Payroll',
        licenseKey: 'payroll',
        items: [
          { label: 'Payroll runs', href: '/dashboard/payroll' },
          { label: 'Payslips', href: '/dashboard/payroll/payslips' },
          { label: 'Statutory', href: '/dashboard/payroll/statutory' },
          { label: 'M-Pesa & disbursements', href: '/dashboard/payroll/disbursements' },
        ],
      },
      {
        sectionId: 'employee-self-service',
        label: 'Employee self-service',
        licenseKey: 'ess',
        items: [
          { label: 'Portal accounts', href: '/dashboard/ess/portal-accounts' },
          { label: 'ESS & shifts', href: '/dashboard/ess/shifts' },
          { label: 'Document requests', href: '/dashboard/ess/document-requests' },
        ],
      },
      {
        sectionId: 'development',
        label: 'Development',
        licenseKey: 'training',
        items: [
          { label: 'Training programs', href: '/dashboard/training' },
          { label: 'Org chart', href: '/dashboard/org-chart' },
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    marketingNumber: '02',
    hubHref: '/dashboard/accounts',
    access: 'subscription',
    switcherKeys: ['accounts'],
    subscriptionKeys: ['accounts'],
    subModules: [
      {
        sectionId: 'finance',
        label: 'Finance',
        licenseKey: 'accounts',
        items: [
          { label: 'Clients', href: '/dashboard/accounts/clients' },
          { label: 'Invoices', href: '/dashboard/accounts/invoices' },
          { label: 'Invoicing setup', href: '/dashboard/accounts/invoicing-setup' },
          { label: 'Receipts & allocations', href: '/dashboard/accounts/receipts' },
          { label: 'M-Pesa reconciliation', href: '/dashboard/accounts/mpesa-reconciliation' },
          { label: 'Payment accounts', href: '/dashboard/accounts/payment-accounts' },
          { label: 'Vendors', href: '/dashboard/accounts/vendors' },
          { label: 'Vendor bills', href: '/dashboard/accounts/vendor-bills' },
          { label: 'Expense claims', href: '/dashboard/accounts/expenses' },
          { label: 'Statements', href: '/dashboard/accounts/statements' },
          { label: 'Budgets', href: '/dashboard/accounts/budgets' },
          { label: 'Petty cash', href: '/dashboard/accounts/petty-cash' },
          { label: 'Financial reports', href: '/dashboard/accounts/financial-reports' },
        ],
      },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    marketingNumber: '03',
    hubHref: '/dashboard/procurement',
    access: 'subscription',
    switcherKeys: ['procurement'],
    subscriptionKeys: ['procurement'],
    subModules: [
      {
        sectionId: 'procurement',
        label: 'Procurement',
        licenseKey: 'procurement',
        items: [
          { label: 'Purchase requests', href: '/dashboard/procurement/purchase-requests' },
          { label: 'LPO register', href: '/dashboard/procurement/lpos' },
          { label: 'Spend dashboard', href: '/dashboard/procurement/spend' },
        ],
      },
    ],
  },
  {
    id: 'legal-documents',
    label: 'Legal & Documents',
    marketingNumber: '04',
    hubHref: '/dashboard/legal',
    access: 'subscription',
    switcherKeys: ['legal', 'documents'],
    subscriptionKeys: ['legal', 'documents'],
    subModules: [
      {
        sectionId: 'legal-documents',
        label: 'Legal & Documents',
        licenseKey: 'legal',
        items: [
          { label: 'Compliance hub', href: '/dashboard/legal' },
          { label: 'Contracts', href: '/dashboard/people/contracts' },
          { label: 'Credentials', href: '/dashboard/credentials' },
          { label: 'Company policies', href: '/dashboard/company-documents' },
          { label: 'Obligations register', href: '/dashboard/legal/obligations' },
        ],
      },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    marketingNumber: '05',
    hubHref: '/dashboard/projects',
    access: 'subscription',
    switcherKeys: ['projects'],
    subscriptionKeys: ['projects'],
    subModules: [
      {
        sectionId: 'projects',
        label: 'Project management',
        licenseKey: 'projects',
        items: [
          { label: 'Overview', href: '/dashboard/projects' },
          { label: 'All projects', href: '/dashboard/projects/all' },
          { label: 'Project board', href: '/dashboard/projects/board' },
          { label: 'Tasks & deliverables', href: '/dashboard/projects/tasks' },
          { label: 'Budget vs actual', href: '/dashboard/projects/budget' },
        ],
      },
    ],
  },
  {
    id: 'fleet-logistics',
    label: 'Fleet management',
    marketingNumber: '06',
    hubHref: '/dashboard/fleet',
    access: 'subscription',
    switcherKeys: ['fleet'],
    subscriptionKeys: ['fleet'],
    subModules: [
      {
        sectionId: 'fleet-operations',
        label: 'Orders & dispatch',
        licenseKey: 'fleet',
        items: [
          { label: 'Transport orders', href: '/dashboard/fleet/orders' },
          { label: 'Route planning', href: '/dashboard/fleet/planning' },
          { label: 'Trip board', href: '/dashboard/fleet/trips' },
          { label: 'Pre-trip compliance', href: '/dashboard/fleet/compliance' },
        ],
      },
      {
        sectionId: 'fleet-monitoring',
        label: 'Monitoring',
        licenseKey: 'fleet',
        items: [
          { label: 'Live tracking', href: '/dashboard/fleet/tracking' },
          { label: 'Geofences', href: '/dashboard/fleet/geofences' },
          { label: 'Driving time', href: '/dashboard/fleet/driving-time' },
          { label: 'Events & alarms', href: '/dashboard/fleet/alarms' },
        ],
      },
      {
        sectionId: 'fleet-assets',
        label: 'Fleet assets',
        licenseKey: 'fleet',
        items: [
          { label: 'Vehicles', href: '/dashboard/fleet/vehicles' },
          { label: 'Service planning', href: '/dashboard/fleet/service' },
          { label: 'Defect reports', href: '/dashboard/fleet/defects' },
          { label: 'Registers', href: '/dashboard/fleet/registers' },
        ],
      },
      {
        sectionId: 'fleet-commercial',
        label: 'Commercial',
        licenseKey: 'fleet',
        items: [
          { label: 'Settlements', href: '/dashboard/fleet/settlements' },
          { label: 'Client billing', href: '/dashboard/fleet/billing' },
          { label: 'Driver performance', href: '/dashboard/fleet/drivers/performance' },
          { label: 'Performance reports', href: '/dashboard/fleet/reports' },
        ],
      },
    ],
  },
  {
    id: 'hr-outsourcing',
    label: 'HR Outsourcing',
    marketingNumber: '09',
    hubHref: '/dashboard/outsourcing',
    access: 'subscription',
    switcherKeys: ['outsourcing'],
    subscriptionKeys: ['outsourcing'],
    subModules: [
      {
        sectionId: 'outsourcing-clients',
        label: 'End clients',
        licenseKey: 'outsourcing',
        items: [
          { label: 'Client register', href: '/dashboard/outsourcing/clients' },
        ],
      },
      {
        sectionId: 'outsourcing-workforce',
        label: 'Workforce',
        licenseKey: 'outsourcing',
        items: [
          { label: 'Employees', href: '/dashboard/outsourcing/employees' },
          { label: 'Departments', href: '/dashboard/outsourcing/departments' },
        ],
      },
      {
        sectionId: 'outsourcing-services',
        label: 'Client services',
        licenseKey: 'outsourcing',
        items: [
          { label: 'Payroll', href: '/dashboard/outsourcing/payroll' },
          { label: 'Time & attendance', href: '/dashboard/outsourcing/attendance' },
          { label: 'Leave', href: '/dashboard/outsourcing/leave' },
          { label: 'Disciplinary', href: '/dashboard/outsourcing/disciplinary' },
        ],
      },
    ],
  },
  {
    id: 'admin-operations',
    label: 'Operations',
    marketingNumber: '07',
    hubHref: '/dashboard/operations',
    access: 'subscription',
    switcherKeys: ['assets', 'hse', 'reports', 'communications'],
    subscriptionKeys: ['assets', 'hse', 'reports', 'communications'],
    subModules: [
      {
        sectionId: 'operations',
        label: 'Operations',
        licenseKey: 'assets',
        items: [
          { label: 'All assets', href: '/dashboard/assets' },
          { label: 'HSE incidents', href: '/dashboard/hse' },
        ],
      },
      {
        sectionId: 'communications-insight',
        label: 'Communications & reports',
        licenseKey: 'reports',
        items: [
          { label: 'Announcements', href: '/dashboard/announcements' },
          { label: 'All reports', href: '/dashboard/reports' },
          { label: 'Analytics', href: '/dashboard/analytics' },
        ],
      },
    ],
  },
  {
    id: 'platform-admin',
    label: 'Platform admin',
    marketingNumber: '08',
    hubHref: '/dashboard/platform',
    access: 'role',
    switcherKeys: [],
    subscriptionKeys: [],
    subModules: [
      {
        sectionId: 'admin',
        label: 'Administration',
        licenseKey: 'core',
        items: [
          { label: 'Company setup', href: '/dashboard/admin/company-setup' },
          { label: 'System users', href: '/dashboard/users/staff' },
          { label: 'Roles & permissions', href: '/dashboard/admin/roles-permissions' },
          { label: 'Public holidays', href: '/dashboard/admin/holidays' },
          { label: 'Facilities', href: '/dashboard/admin/facilities' },
          { label: 'Board & governance', href: '/dashboard/admin/governance' },
          { label: 'Audit log', href: '/dashboard/admin/audit-log' },
          { label: 'Settings', href: '/dashboard/settings' },
        ],
      },
    ],
  },
];

/** Industry vertical packs — app-only keys until control-plane matrix catches up. */
export const STRIDE_VERTICAL_PACKS: {
  key: ModuleKey;
  label: string;
  hubHref: string;
}[] = [
  { key: 'sacco', label: 'SACCO', hubHref: '/dashboard/sacco' },
  { key: 'healthcare', label: 'Healthcare', hubHref: '/dashboard/healthcare' },
  { key: 'energy', label: 'Energy', hubHref: '/dashboard/energy' },
  { key: 'construction', label: 'Construction', hubHref: '/dashboard/construction' },
];

export function getStrideProductModule(id: DashboardModuleDomainId): StrideProductModule {
  const found = STRIDE_PRODUCT_MODULES.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown product module: ${id}`);
  return found;
}
