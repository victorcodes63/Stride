import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  Gavel,
  Landmark,
  Megaphone,
  Route,
  Scale,
  Shield,
  ShoppingCart,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { getDashboardModuleDomain } from '@/lib/dashboard-module-domains';
import { getDomainQuickActions } from '@/lib/dashboard-domain-quick-actions';
import type { UserSummary } from '@/types/dashboard';
import type { ModuleKey } from '@/lib/modules';

export type ModuleHomeLink = {
  href: string;
  label: string;
  note?: string;
  icon: LucideIcon;
};

export type ModuleHomeWorkspace = {
  title: string;
  links: ModuleHomeLink[];
};

export type ModuleHomeMeta = {
  domainId: DashboardModuleDomainId;
  eyebrow: string;
  title: string;
  description: string;
  phase?: string;
  workspaces: ModuleHomeWorkspace[];
  plannedBullets?: string[];
};

export function getModuleHomeMeta(domainId: DashboardModuleDomainId): ModuleHomeMeta {
  const domain = getDashboardModuleDomain(domainId);

  switch (domainId) {
    case 'hr-payroll':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'People & workforce',
        description:
          'Headcount, leave, time, payroll, recruitment, and employee lifecycle — your HR command post.',
        workspaces: [
          {
            title: 'People',
            links: [
              { href: '/dashboard/employees', label: 'Employees', note: 'Directory & profiles', icon: Users },
              { href: '/dashboard/onboarding', label: 'Onboarding', note: 'Workflows & tasks', icon: UserPlus },
              { href: '/dashboard/departments', label: 'Departments', note: 'Org structure', icon: Building2 },
            ],
          },
          {
            title: 'Time & leave',
            links: [
              { href: '/dashboard/attendance', label: 'Attendance', note: 'Clock data & exceptions', icon: ClipboardList },
              { href: '/dashboard/staff-leave', label: 'Leave', note: 'Applications & approvals', icon: CalendarDays },
              { href: '/dashboard/rota', label: 'Rota', note: 'Shifts & schedules', icon: CalendarDays },
            ],
          },
          {
            title: 'Payroll & recruitment',
            links: [
              { href: '/dashboard/payroll', label: 'Payroll runs', note: 'Gross, net & statutory', icon: Wallet },
              { href: '/dashboard/jobs', label: 'Jobs & ATS', note: 'Open roles & applicants', icon: Briefcase },
              { href: '/dashboard/performance', label: 'Performance', note: 'Reviews & goals', icon: BarChart3 },
            ],
          },
        ],
      };

    case 'finance':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Finance overview',
        description: 'Invoicing, accounts payable, expenses, budgets, and financial reporting.',
        workspaces: [
          {
            title: 'Receivables',
            links: [
              { href: '/dashboard/accounts/invoices', label: 'Invoices', note: 'Bill clients', icon: FileText },
              { href: '/dashboard/accounts/receipts', label: 'Receipts', note: 'Allocate payments', icon: Landmark },
              { href: '/dashboard/accounts/clients', label: 'Billing clients', note: 'Debtor master', icon: Building2 },
            ],
          },
          {
            title: 'Payables',
            links: [
              { href: '/dashboard/accounts/vendor-bills', label: 'Vendor bills', note: 'AP & approvals', icon: Wallet },
              { href: '/dashboard/accounts/vendors', label: 'Vendors', note: 'Creditor profiles', icon: Users },
              { href: '/dashboard/accounts/expenses', label: 'Expense claims', note: 'Submit & approve', icon: FileText },
            ],
          },
          {
            title: 'Control & reporting',
            links: [
              { href: '/dashboard/accounts/budgets', label: 'Budgets', note: 'Department tracking', icon: Scale },
              { href: '/dashboard/accounts/financial-reports', label: 'Financial reports', note: 'P&L & analysis', icon: BarChart3 },
              { href: '/dashboard/accounts/statements', label: 'Statements', note: 'Debtors & creditors', icon: Scale },
            ],
          },
        ],
      };

    case 'procurement':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Procurement',
        description:
          'Purchase-to-pay: requests, LPOs, goods receipt, and spend visibility. Vendor master lives in Finance; purchase requests are live.',
        phase: 'Phase C — in progress',
        plannedBullets: [
          'LPO generation and vendor dispatch',
          'Goods receipt and three-way match',
          'Department spend vs budget',
        ],
        workspaces: [
          {
            title: 'Use today',
            links: [
              { href: '/dashboard/procurement/purchase-requests', label: 'Purchase requests', note: 'Approval workflow', icon: ClipboardList },
              { href: '/dashboard/accounts/vendors', label: 'Vendors', note: 'Live in Finance', icon: Building2 },
              { href: '/dashboard/accounts/vendor-bills', label: 'Vendor bills', note: 'AP queue', icon: Wallet },
              { href: '/dashboard/accounts/expenses', label: 'Expense claims', note: 'Approval pattern', icon: FileText },
              { href: '/dashboard/accounts/budgets', label: 'Budgets', note: 'Spend control', icon: Scale },
            ],
          },
          {
            title: 'Coming soon',
            links: [
              { href: '/dashboard/procurement/lpos', label: 'LPO register', note: 'Roadmap', icon: FileSignature },
              { href: '/dashboard/procurement/spend', label: 'Spend dashboard', note: 'Roadmap', icon: ShoppingCart },
            ],
          },
        ],
      };

    case 'legal-documents':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Legal & compliance',
        description:
          'Contracts, credentials, company policies, and regulatory obligations — one place for document risk.',
        phase: 'Phase B — partial',
        plannedBullets: ['Obligation register with owners and due dates', 'Board filing deadlines', 'Evidence document vault'],
        workspaces: [
          {
            title: 'Live today',
            links: [
              { href: '/dashboard/people/contracts', label: 'Contracts', note: 'Renewals & reminders', icon: FileSignature },
              { href: '/dashboard/credentials', label: 'Credentials', note: 'Licences & certifications', icon: Gavel },
              { href: '/dashboard/company-documents', label: 'Company policies', note: 'Policy library', icon: FileText },
            ],
          },
          {
            title: 'Planned',
            links: [
              { href: '/dashboard/legal/obligations', label: 'Obligations register', note: 'Roadmap', icon: Scale },
            ],
          },
        ],
      };

    case 'projects':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Projects',
        description: 'Deliverables, tasks, and budget vs execution across client and internal work.',
        phase: 'Phase D — planned',
        plannedBullets: [
          'Project charter and milestones',
          'Task board with owners',
          'Budget vs actual from Finance & Payroll',
        ],
        workspaces: [
          {
            title: 'Related today',
            links: [
              { href: '/dashboard/accounts/budgets', label: 'Budgets', note: 'Finance — not project-scoped yet', icon: Scale },
              { href: '/dashboard/onboarding', label: 'Onboarding tasks', note: 'HR task pattern', icon: ClipboardList },
            ],
          },
          {
            title: 'Coming soon',
            links: [
              { href: '/dashboard/projects/board', label: 'Project board', note: 'Roadmap', icon: Briefcase },
              { href: '/dashboard/projects/tasks', label: 'Tasks & deliverables', note: 'Roadmap', icon: ClipboardList },
            ],
          },
        ],
      };

    case 'admin-operations':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Admin & operations',
        description: 'Fleet, assets, HSE, communications, reporting, and system administration.',
        workspaces: [
          {
            title: 'Operations',
            links: [
              { href: '/dashboard/fleet', label: 'Fleet', note: 'Trips & vehicles', icon: Truck },
              { href: '/dashboard/assets', label: 'Assets', note: 'Equipment register', icon: Building2 },
              { href: '/dashboard/hse', label: 'HSE', note: 'Incidents & safety', icon: Shield },
            ],
          },
          {
            title: 'Communications & insight',
            links: [
              { href: '/dashboard/announcements', label: 'Announcements', note: 'Company comms', icon: Megaphone },
              { href: '/dashboard/reports', label: 'Reports', note: 'Exports & summaries', icon: BarChart3 },
              { href: '/dashboard/analytics', label: 'Analytics', note: 'Executive dashboards', icon: BarChart3 },
            ],
          },
          {
            title: 'Administration',
            links: [
              { href: '/dashboard/settings', label: 'Settings', note: 'Workspace defaults', icon: Landmark },
              { href: '/dashboard/users/staff', label: 'System users', note: 'Staff accounts', icon: Users },
              { href: '/dashboard/admin/audit-log', label: 'Audit log', note: 'Governance trail', icon: Shield },
            ],
          },
        ],
      };
  }
}

export function getModuleHomeHeaderActions(
  domainId: DashboardModuleDomainId,
  user: UserSummary | null,
  modules: Partial<Record<ModuleKey, boolean>>,
) {
  const { primary, more } = getDomainQuickActions(domainId, user, modules);
  const actions = [
    { href: primary.href, label: primary.label, icon: primary.icon, variant: 'primary' as const },
  ];
  if (more[0]) {
    actions.push({
      href: more[0].href,
      label: more[0].label,
      icon: more[0].icon,
      variant: 'secondary' as const,
    });
  }
  return actions;
}
