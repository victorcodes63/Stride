/**
 * Domain-specific quick actions for the topbar — primary CTA + secondary items per module.
 *
 * TODO(tier-licensing): Filter domains/actions by DEPLOYMENT_TIER (Starter / Growth / Enterprise).
 */

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Building2,
  CalendarCheck,
  FileSignature,
  FileText,
  Gavel,
  Megaphone,
  Plus,
  Receipt,
  Route,
  ShoppingCart,
  UserCog,
  UserPlus,
  Wallet,
} from 'lucide-react';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import type { ModuleKey } from '@/lib/modules';
import type { UserSummary } from '@/types/dashboard';

export type DomainQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type DomainQuickActions = {
  primary: DomainQuickAction;
  more: DomainQuickAction[];
};

function on(modules: Partial<Record<ModuleKey, boolean>>, key: ModuleKey): boolean {
  return modules[key] !== false;
}

export function getDomainQuickActions(
  domainId: DashboardModuleDomainId,
  user: UserSummary | null,
  modules: Partial<Record<ModuleKey, boolean>> = {},
): DomainQuickActions {
  switch (domainId) {
    case 'hr-payroll':
      return {
        primary: {
          label: 'Add employee',
          href: '/dashboard/employees/new',
          icon: UserPlus,
          description: 'Create a new employee record',
        },
        more: [
          ...(on(modules, 'leave') && user?.canApproveStaffLeave
            ? [{ label: 'Review leave queue', href: '/dashboard/leave', icon: CalendarCheck }]
            : []),
          ...(on(modules, 'time')
            ? [{ label: 'Schedule rota shift', href: '/dashboard/rota', icon: CalendarCheck }]
            : []),
          { label: 'Create contract', href: '/dashboard/people/contracts', icon: FileSignature },
          ...(on(modules, 'ats')
            ? [{ label: 'Post job opening', href: '/dashboard/jobs/new', icon: Briefcase }]
            : []),
          ...(user?.role === 'admin'
            ? [{ label: 'Add system user', href: '/dashboard/users/staff', icon: UserCog }]
            : []),
        ],
      };

    case 'finance':
      return {
        primary: {
          label: 'New invoice',
          href: '/dashboard/accounts/invoices/new',
          icon: FileText,
          description: 'Bill a client',
        },
        more: [
          { label: 'Record receipt', href: '/dashboard/accounts/receipts', icon: Receipt },
          { label: 'New vendor bill', href: '/dashboard/accounts/vendor-bills/new', icon: Wallet },
          { label: 'Expense claim', href: '/dashboard/accounts/expenses', icon: Receipt },
          ...(on(modules, 'payroll')
            ? [{ label: 'Open payroll run', href: '/dashboard/payroll', icon: Banknote }]
            : []),
        ],
      };

    case 'procurement':
      return {
        primary: {
          label: 'Purchase request',
          href: '/dashboard/procurement/purchase-requests',
          icon: ShoppingCart,
          description: 'Raise a new PR (roadmap)',
        },
        more: [
          { label: 'Procurement overview', href: '/dashboard/procurement', icon: ShoppingCart },
          { label: 'Vendors (Finance)', href: '/dashboard/accounts/vendors', icon: Building2 },
          { label: 'Vendor bills', href: '/dashboard/accounts/vendor-bills', icon: Wallet },
        ],
      };

    case 'legal-documents':
      return {
        primary: {
          label: 'Add credential',
          href: '/dashboard/credentials',
          icon: Gavel,
          description: 'Track licence or certification',
        },
        more: [
          { label: 'Contracts register', href: '/dashboard/people/contracts', icon: FileSignature },
          { label: 'Company policies', href: '/dashboard/company-documents', icon: FileText },
          { label: 'Compliance hub', href: '/dashboard/legal', icon: Gavel },
        ],
      };

    case 'projects':
      return {
        primary: {
          label: 'New project',
          href: '/dashboard/projects/board',
          icon: Briefcase,
          description: 'Project workspace (roadmap)',
        },
        more: [
          { label: 'Projects overview', href: '/dashboard/projects', icon: Briefcase },
          { label: 'Tasks & deliverables', href: '/dashboard/projects/tasks', icon: Plus },
          { label: 'Budgets', href: '/dashboard/accounts/budgets', icon: Wallet },
        ],
      };

    case 'admin-operations':
      return {
        primary: {
          label: 'New trip',
          href: '/dashboard/fleet/trips',
          icon: Route,
          description: 'Fleet trip board',
        },
        more: [
          ...(on(modules, 'fleet')
            ? [{ label: 'Fleet overview', href: '/dashboard/fleet', icon: Route }]
            : []),
          ...(on(modules, 'communications')
            ? [{ label: 'Post announcement', href: '/dashboard/announcements', icon: Megaphone }]
            : []),
          ...(on(modules, 'assets')
            ? [{ label: 'Register asset', href: '/dashboard/assets', icon: Building2 }]
            : []),
          ...(on(modules, 'hse')
            ? [{ label: 'Log HSE incident', href: '/dashboard/hse', icon: AlertTriangle }]
            : []),
        ],
      };
  }
}
