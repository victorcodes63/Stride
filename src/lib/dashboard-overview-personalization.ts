import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  Gavel,
  Inbox,
  Landmark,
  Route,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { UserSummary } from '@/types/dashboard';
import { resolvePersonalDisplayName } from '@/lib/personal-display-name';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import type { ModuleKey } from '@/lib/modules';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { DASHBOARD_MODULE_DOMAINS } from '@/lib/dashboard-module-domains';

export type OverviewPersona =
  | 'admin'
  | 'director'
  | 'finance'
  | 'business_manager'
  | 'operations'
  | 'viewer';

export type OverviewShortcut = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
};

export type OverviewPrimaryAction = {
  href: string;
  label: string;
  icon: LucideIcon;
  variant: 'primary' | 'secondary';
};

export type OverviewCrossModuleMetrics = {
  invoicesOutstanding: number;
  vendorBillsOutstanding: number;
  activeFleetTrips: number;
  openFleetIncidents: number;
  pendingPurchaseRequests: number;
};

export type OverviewDomainSnapshot = {
  domainId: DashboardModuleDomainId;
  lines: string[];
};

export type OverviewKpiChartSegment = {
  label: string;
  value: number;
  tone: 'primary' | 'emerald' | 'amber' | 'violet' | 'rose' | 'muted';
};

export type CrossModuleKpi = {
  domainId: DashboardModuleDomainId;
  label: string;
  value: number | string;
  note: string;
  href: string;
  icon: LucideIcon;
  variant: 'primary' | 'emerald' | 'amber' | 'violet';
  show: boolean;
  chartSegments: OverviewKpiChartSegment[];
  chartPlaceholder?: boolean;
};

export type OverviewAttentionItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: 'amber' | 'rose' | 'sky' | 'neutral';
  domainId: DashboardModuleDomainId;
};

export function resolveOverviewPersona(user: UserSummary | null): OverviewPersona {
  if (!user) return 'operations';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'viewer') return 'viewer';
  if (user.staffUserType === 'director') return 'director';
  if (user.staffUserType === 'finance' || user.hasAccountsAccess) return 'finance';
  if (user.staffUserType === 'business_manager') return 'business_manager';
  return 'operations';
}

const GENERIC_NAME_PARTS = new Set(['system', 'admin', 'administrator']);

/** First name for greetings — skips generic placeholder tokens like "System". */
export function greetingFirstName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'there';
  const personal = parts.filter((part) => !GENERIC_NAME_PARTS.has(part.toLowerCase()));
  if (personal.length > 0) return personal[0]!;
  if (parts.length > 1) return parts[parts.length - 1]!;
  return 'there';
}

export function getOverviewGreeting(name: string, email?: string | null): string {
  const first = greetingFirstName(resolvePersonalDisplayName({ name, email }));
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export function getOverviewRoleLabel(user: UserSummary | null): string {
  if (!user) return 'Staff';
  if (user.role === 'admin') return 'Administrator';
  if (user.role === 'viewer') return 'Viewer';
  return STAFF_USER_TYPE_LABELS[user.staffUserType] ?? 'Staff';
}

export function getOverviewSubtitle(persona: OverviewPersona): string {
  switch (persona) {
    case 'admin':
      return 'Your command center — what needs action across HR, Finance, Legal, and Operations today.';
    case 'director':
      return 'Board-ready signals across people, finance, compliance, and operations.';
    case 'finance':
      return 'Cash, payables, payroll, and approvals — finance-first view of the business.';
    case 'business_manager':
      return 'Your team’s people workflows — expand HR details below when you need depth.';
    case 'viewer':
      return 'Read-only snapshot. Contact an administrator to request access changes.';
    default:
      return 'Business command center — pick a module below or jump to what needs you today.';
  }
}

export function getOverviewPrimaryAction(
  user: UserSummary | null,
  persona: OverviewPersona,
  pendingLeave: number,
): OverviewPrimaryAction {
  if (persona === 'business_manager' && pendingLeave > 0) {
    return { href: '/dashboard/leave', label: 'Review leave queue', icon: Inbox, variant: 'primary' };
  }
  if (persona === 'finance') {
    if (user?.hasAccountsAccess) {
      return { href: '/dashboard/accounts', label: 'Finance overview', icon: Landmark, variant: 'primary' };
    }
    return { href: '/dashboard/payroll', label: 'Open payroll', icon: Wallet, variant: 'primary' };
  }
  if (persona === 'director' && user?.canViewSystemAnalytics) {
    return { href: '/dashboard/analytics', label: 'Executive analytics', icon: BarChart3, variant: 'primary' };
  }
  if (persona === 'admin' && user?.hasAccountsAccess) {
    return { href: '/dashboard/accounts', label: 'Open Finance', icon: Landmark, variant: 'primary' };
  }
  if (persona === 'viewer') {
    return { href: '/dashboard/reports', label: 'View reports', icon: BarChart3, variant: 'secondary' };
  }
  return { href: '/dashboard/accounts', label: 'Browse modules', icon: Landmark, variant: 'primary' };
}

export function getOverviewSecondaryAction(
  user: UserSummary | null,
  persona: OverviewPersona,
  modules: Partial<Record<ModuleKey, boolean>> = {},
): OverviewPrimaryAction | null {
  if (persona === 'admin' && user?.canViewSystemAnalytics) {
    return { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, variant: 'secondary' };
  }
  if ((persona === 'admin' || persona === 'director') && modules.fleet === true) {
    return { href: '/dashboard/fleet', label: 'Fleet & ops', icon: Route, variant: 'secondary' };
  }
  if (persona === 'finance' && user?.hasAccountsAccess) {
    return { href: '/dashboard/accounts/invoices', label: 'Invoices', icon: FileText, variant: 'secondary' };
  }
  if (persona === 'business_manager') {
    return { href: '/dashboard/onboarding', label: 'Onboarding', icon: UserPlus, variant: 'secondary' };
  }
  return { href: '/dashboard/employees', label: 'Employees', icon: Users, variant: 'secondary' };
}

export function buildDefaultShortcuts(
  user: UserSummary | null,
  persona: OverviewPersona,
  modules: Partial<Record<ModuleKey, boolean>>,
): OverviewShortcut[] {
  const on = (key: ModuleKey) => modules[key] === true;
  const shortcuts: OverviewShortcut[] = [];

  if (user?.hasAccountsAccess && on('accounts')) {
    shortcuts.push({
      href: '/dashboard/accounts',
      label: 'Finance',
      desc: 'Invoices, AP & billing',
      icon: Landmark,
    });
  }
  if (on('fleet') && (persona === 'admin' || persona === 'director' || persona === 'operations')) {
    shortcuts.push({
      href: '/dashboard/fleet',
      label: 'Fleet',
      desc: 'Trips & compliance',
      icon: Route,
    });
  }
  if (on('legal') || on('documents')) {
    shortcuts.push({
      href: '/dashboard/legal',
      label: 'Legal',
      desc: 'Contracts & credentials',
      icon: Gavel,
    });
  }
  if (on('procurement')) {
    shortcuts.push({
      href: '/dashboard/procurement',
      label: 'Procurement',
      desc: 'Purchase requests',
      icon: ShoppingCart,
    });
  }
  if (on('payroll') && persona !== 'viewer') {
    shortcuts.push({
      href: '/dashboard/payroll',
      label: 'Payroll',
      desc: 'Runs & payslips',
      icon: Wallet,
    });
  }
  if (on('leave') && (user?.canApproveStaffLeave || persona === 'admin' || persona === 'business_manager')) {
    shortcuts.push({
      href: '/dashboard/leave',
      label: 'Leave queue',
      desc: 'Approve or decline',
      icon: CalendarDays,
    });
  }
  if (on('core')) {
    shortcuts.push({
      href: '/dashboard/employees',
      label: 'Employees',
      desc: 'Directory & profiles',
      icon: Users,
    });
  }
  if (persona === 'director' && user?.canViewSystemAnalytics) {
    shortcuts.unshift({
      href: '/dashboard/analytics',
      label: 'Analytics',
      desc: 'Executive summary',
      icon: BarChart3,
    });
  }

  return shortcuts.slice(0, 6);
}

export function buildAttentionItems(input: {
  pendingLeave: number;
  openAttendanceExceptions: number;
  credentialsExpiring: number;
  credentialsExpired: number;
  myOnboardingCount: number;
  unreadNotifications: number;
  crossModule?: OverviewCrossModuleMetrics;
  persona: OverviewPersona;
  modules: Partial<Record<ModuleKey, boolean>>;
}): OverviewAttentionItem[] {
  const items: OverviewAttentionItem[] = [];
  const on = (key: ModuleKey) => input.modules[key] === true;
  const cross = input.crossModule;

  if (on('accounts') && cross && cross.invoicesOutstanding > 0) {
    items.push({
      id: 'invoices',
      label: 'Unpaid invoices',
      detail: `${cross.invoicesOutstanding} invoice${cross.invoicesOutstanding === 1 ? '' : 's'} awaiting payment`,
      href: '/dashboard/accounts/invoices?status=unpaid',
      tone: 'amber',
      domainId: 'finance',
    });
  }
  if (on('accounts') && cross && cross.vendorBillsOutstanding > 0) {
    items.push({
      id: 'vendor-bills',
      label: 'Vendor bills',
      detail: `${cross.vendorBillsOutstanding} bill${cross.vendorBillsOutstanding === 1 ? '' : 's'} to pay or approve`,
      href: '/dashboard/accounts/vendor-bills?status=unpaid',
      tone: 'amber',
      domainId: 'procurement',
    });
  }
  if (on('core') && cross && cross.pendingPurchaseRequests > 0) {
    items.push({
      id: 'purchase-requests',
      label: 'Purchase requests',
      detail: `${cross.pendingPurchaseRequests} awaiting approval`,
      href: '/dashboard/procurement/purchase-requests?status=submitted',
      tone: 'amber',
      domainId: 'procurement',
    });
  }
  if (on('fleet') && cross && cross.openFleetIncidents > 0) {
    items.push({
      id: 'fleet-incidents',
      label: 'Fleet incidents',
      detail: `${cross.openFleetIncidents} open incident${cross.openFleetIncidents === 1 ? '' : 's'}`,
      href: '/dashboard/fleet/compliance',
      tone: 'rose',
      domainId: 'fleet-logistics',
    });
  }

  if (on('leave') && input.pendingLeave > 0 && input.persona !== 'viewer') {
    items.push({
      id: 'leave',
      label: 'Leave approvals',
      detail: `${input.pendingLeave} request${input.pendingLeave === 1 ? '' : 's'} awaiting action`,
      href: '/dashboard/staff-leave?tab=approvals',
      tone: 'amber',
      domainId: 'hr-payroll',
    });
  }
  if (on('time') && input.openAttendanceExceptions > 0) {
    items.push({
      id: 'attendance',
      label: 'Attendance exceptions',
      detail: `${input.openAttendanceExceptions} open — review clock data`,
      href: '/dashboard/attendance?status=open',
      tone: 'rose',
      domainId: 'hr-payroll',
    });
  }
  if (on('core') && (input.credentialsExpiring > 0 || input.credentialsExpired > 0)) {
    items.push({
      id: 'credentials',
      label: 'Credentials',
      detail: [
        input.credentialsExpiring > 0 ? `${input.credentialsExpiring} expiring soon` : null,
        input.credentialsExpired > 0 ? `${input.credentialsExpired} expired` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      href: input.credentialsExpired > 0
        ? '/dashboard/credentials?status=expired'
        : '/dashboard/credentials?status=expiring_soon',
      tone: 'amber',
      domainId: 'legal-documents',
    });
  }
  if (on('core') && input.myOnboardingCount > 0) {
    items.push({
      id: 'onboarding',
      label: 'Onboarding tasks',
      detail: `${input.myOnboardingCount} assigned to you`,
      href: '/dashboard/onboarding?status=IN_PROGRESS',
      tone: 'sky',
      domainId: 'hr-payroll',
    });
  }
  if (input.unreadNotifications > 0) {
    items.push({
      id: 'notifications',
      label: 'Notifications',
      detail: `${input.unreadNotifications} unread update${input.unreadNotifications === 1 ? '' : 's'}`,
      href: '/dashboard/settings',
      tone: 'neutral',
      domainId: 'platform-admin',
    });
  }
  return items;
}

/** Group attention items by platform module for the overview command center. */
export function groupAttentionByDomain(
  items: OverviewAttentionItem[],
): Partial<Record<DashboardModuleDomainId, OverviewAttentionItem[]>> {
  const map: Partial<Record<DashboardModuleDomainId, OverviewAttentionItem[]>> = {};
  for (const item of items) {
    const bucket = map[item.domainId] ?? [];
    bucket.push(item);
    map[item.domainId] = bucket;
  }
  return map;
}

/** Highest-priority attention item for hero CTA (rose > amber > sky > neutral). */
export function pickTopAttentionAction(
  items: OverviewAttentionItem[],
): OverviewPrimaryAction | null {
  if (!items.length) return null;
  const rank = { rose: 0, amber: 1, sky: 2, neutral: 3 };
  const sorted = [...items].sort((a, b) => rank[a.tone] - rank[b.tone]);
  const top = sorted[0]!;
  return {
    href: top.href,
    label: top.label,
    icon: Inbox,
    variant: 'primary',
  };
}

export function shouldShowPayrollBlock(persona: OverviewPersona, payrollDenied: boolean): boolean {
  if (payrollDenied) return persona === 'finance' || persona === 'admin' || persona === 'director';
  return persona === 'finance' || persona === 'business_manager' || persona === 'operations';
}

/** Prefer HR detail panels for people managers; keep command center lean for exec/finance roles. */
export function shouldExpandHrDetails(persona: OverviewPersona): boolean {
  return persona === 'business_manager' || persona === 'operations';
}

export function buildDomainSnapshots(input: {
  totalStaff: number;
  pendingLeave: number;
  onDuty: number;
  credentialsExpiring: number;
  credentialsExpired: number;
  crossModule: OverviewCrossModuleMetrics;
  modules: Partial<Record<ModuleKey, boolean>>;
}): OverviewDomainSnapshot[] {
  const on = (key: ModuleKey) => input.modules[key] === true;
  const { crossModule: cross } = input;

  return DASHBOARD_MODULE_DOMAINS.map((domain) => {
    const lines: string[] = [];
    switch (domain.id) {
      case 'hr-payroll':
        if (on('core')) lines.push(`${input.totalStaff} staff`);
        if (on('time')) lines.push(`${input.onDuty} on duty today`);
        if (on('leave') && input.pendingLeave > 0) {
          lines.push(`${input.pendingLeave} leave pending`);
        }
        break;
      case 'finance':
        if (on('accounts')) {
          lines.push(`${cross.invoicesOutstanding} unpaid invoices`);
          if (cross.vendorBillsOutstanding > 0) {
            lines.push(`${cross.vendorBillsOutstanding} vendor bills due`);
          }
        }
        break;
      case 'procurement':
        if (on('core') && cross.pendingPurchaseRequests > 0) {
          lines.push(`${cross.pendingPurchaseRequests} PRs awaiting approval`);
        }
        if (on('accounts') && cross.vendorBillsOutstanding > 0) {
          lines.push(`${cross.vendorBillsOutstanding} bills in AP queue`);
        }
        if (!lines.length) lines.push('Purchase requests live');
        break;
      case 'legal-documents':
        if (input.credentialsExpired > 0) lines.push(`${input.credentialsExpired} expired`);
        if (input.credentialsExpiring > 0) lines.push(`${input.credentialsExpiring} expiring soon`);
        if (!lines.length) lines.push('Credentials up to date');
        break;
      case 'projects':
        lines.push('Deliverables & budgets (roadmap)');
        break;
      case 'fleet-logistics':
        if (on('fleet')) {
          lines.push(`${cross.activeFleetTrips} active trips`);
          if (cross.openFleetIncidents > 0) lines.push(`${cross.openFleetIncidents} incidents open`);
        }
        if (!lines.length) lines.push('Fleet workspace');
        break;
      case 'admin-operations':
        if (!lines.length) lines.push('Assets, HSE & comms');
        break;
      case 'platform-admin':
        if (input.credentialsExpired > 0) lines.push(`${input.credentialsExpired} credentials expired`);
        if (!lines.length) lines.push('Company & workspace settings');
        break;
    }
    return { domainId: domain.id, lines };
  });
}

export function buildCrossModuleKpis(input: {
  totalStaff: number;
  onDuty: number;
  pendingLeave: number;
  credentialsExpiring: number;
  credentialsExpired: number;
  crossModule: OverviewCrossModuleMetrics;
  persona: OverviewPersona;
  modules: Partial<Record<ModuleKey, boolean>>;
}): CrossModuleKpi[] {
  const on = (key: ModuleKey) => input.modules[key] === true;
  const credentialAlerts = input.credentialsExpiring + input.credentialsExpired;

  return [
    {
      domainId: 'hr-payroll',
      label: 'HR & Payroll',
      value: input.pendingLeave > 0 ? input.pendingLeave : input.totalStaff,
      note: input.pendingLeave > 0 ? 'Leave awaiting approval' : 'Active staff',
      href: input.pendingLeave > 0 ? '/dashboard/staff-leave?tab=approvals' : '/dashboard/people',
      icon: Users,
      variant: input.pendingLeave > 0 ? 'amber' : 'primary',
      show: on('core') || on('leave'),
      chartSegments: [
        { label: 'Staff', value: input.totalStaff, tone: 'primary' },
        { label: 'On duty', value: input.onDuty, tone: 'emerald' },
        {
          label: 'Leave',
          value: input.pendingLeave,
          tone: input.pendingLeave > 0 ? 'amber' : 'muted',
        },
      ],
    },
    {
      domainId: 'finance',
      label: 'Finance',
      value: input.crossModule.invoicesOutstanding,
      note: 'Unpaid invoices',
      href: '/dashboard/accounts/invoices?status=unpaid',
      icon: Landmark,
      variant: input.crossModule.invoicesOutstanding > 0 ? 'amber' : 'emerald',
      show: on('accounts'),
      chartSegments: [
        {
          label: 'Invoices',
          value: input.crossModule.invoicesOutstanding,
          tone: input.crossModule.invoicesOutstanding > 0 ? 'amber' : 'emerald',
        },
        {
          label: 'Bills',
          value: input.crossModule.vendorBillsOutstanding,
          tone: input.crossModule.vendorBillsOutstanding > 0 ? 'rose' : 'muted',
        },
      ],
    },
    {
      domainId: 'procurement',
      label: 'Procurement',
      value:
        input.crossModule.pendingPurchaseRequests > 0
          ? input.crossModule.pendingPurchaseRequests
          : input.crossModule.vendorBillsOutstanding,
      note:
        input.crossModule.pendingPurchaseRequests > 0
          ? 'PRs awaiting approval'
          : 'Vendor bills due',
      href:
        input.crossModule.pendingPurchaseRequests > 0
          ? '/dashboard/procurement/purchase-requests?status=submitted'
          : '/dashboard/accounts/vendor-bills?status=unpaid',
      icon: ShoppingCart,
      variant:
        input.crossModule.pendingPurchaseRequests > 0 || input.crossModule.vendorBillsOutstanding > 0
          ? 'amber'
          : 'violet',
      show: on('core') || on('accounts'),
      chartSegments: [
        {
          label: 'PRs',
          value: input.crossModule.pendingPurchaseRequests,
          tone: input.crossModule.pendingPurchaseRequests > 0 ? 'amber' : 'muted',
        },
        {
          label: 'Bills',
          value: input.crossModule.vendorBillsOutstanding,
          tone: input.crossModule.vendorBillsOutstanding > 0 ? 'violet' : 'muted',
        },
      ],
    },
    {
      domainId: 'legal-documents',
      label: 'Legal',
      value: credentialAlerts,
      note: credentialAlerts > 0 ? 'Credential alerts' : 'Compliance clear',
      href: credentialAlerts > 0 ? '/dashboard/credentials?status=expiring_soon' : '/dashboard/legal',
      icon: Gavel,
      variant: credentialAlerts > 0 ? 'amber' : 'emerald',
      show: on('core'),
      chartSegments: [
        {
          label: 'Expiring',
          value: input.credentialsExpiring,
          tone: input.credentialsExpiring > 0 ? 'amber' : 'muted',
        },
        {
          label: 'Expired',
          value: input.credentialsExpired,
          tone: input.credentialsExpired > 0 ? 'rose' : 'muted',
        },
      ],
    },
    {
      domainId: 'projects',
      label: 'Projects',
      value: '—',
      note: 'Workspace (roadmap)',
      href: '/dashboard/projects',
      icon: ClipboardList,
      variant: 'violet',
      show: true,
      chartSegments: [
        { label: 'Plan', value: 0, tone: 'muted' },
        { label: 'Build', value: 0, tone: 'muted' },
        { label: 'Track', value: 0, tone: 'muted' },
        { label: 'Close', value: 0, tone: 'muted' },
      ],
      chartPlaceholder: true,
    },
    {
      domainId: 'fleet-logistics',
      label: 'Fleet management',
      value: input.crossModule.activeFleetTrips,
      note:
        input.crossModule.openFleetIncidents > 0
          ? `${input.crossModule.openFleetIncidents} fleet incident${input.crossModule.openFleetIncidents === 1 ? '' : 's'}`
          : 'Active fleet trips',
      href: input.crossModule.openFleetIncidents > 0 ? '/dashboard/fleet/compliance' : '/dashboard/fleet',
      icon: Route,
      variant: input.crossModule.openFleetIncidents > 0 ? 'amber' : 'violet',
      show: on('fleet'),
      chartSegments: [
        {
          label: 'Trips',
          value: input.crossModule.activeFleetTrips,
          tone: input.crossModule.activeFleetTrips > 0 ? 'violet' : 'muted',
        },
        {
          label: 'Incidents',
          value: input.crossModule.openFleetIncidents,
          tone: input.crossModule.openFleetIncidents > 0 ? 'amber' : 'muted',
        },
      ],
    },
  ].filter((k) => k.show);
}
