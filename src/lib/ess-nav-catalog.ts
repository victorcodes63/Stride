import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Clock3,
  FileText,
  Fingerprint,
  Home,
  Landmark,
  ListTodo,
  Package,
  Receipt,
  Shield,
  ShieldAlert,
  Target,
  User,
  Users,
  Wallet,
  LayoutGrid,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/modules';

export type EssTabId = 'home' | 'work' | 'pay' | 'team' | 'more';

export type EssTabItem = {
  id: EssTabId;
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ESS_PRIMARY_TABS: EssTabItem[] = [
  { id: 'home', href: '/ess', label: 'Home', icon: Home },
  { id: 'work', href: '/ess/work', label: 'Work', icon: CalendarDays },
  { id: 'pay', href: '/ess/pay', label: 'Pay', icon: Receipt },
  { id: 'team', href: '/ess/team', label: 'Team', icon: Users },
  { id: 'more', href: '/ess/more', label: 'More', icon: LayoutGrid },
];

/** Path prefixes that activate each tab (longest match wins in layout). */
export const ESS_TAB_ACTIVE_PREFIXES: Record<EssTabId, string[]> = {
  home: [],
  work: [
    '/ess/work',
    '/ess/leave',
    '/ess/attendance',
    '/ess/rota',
    '/ess/onboarding',
  ],
  pay: ['/ess/pay', '/ess/payslips'],
  team: ['/ess/team', '/ess/leave-approvals'],
  more: [
    '/ess/more',
    '/ess/account-security',
    '/ess/install',
    '/ess/offline',
    '/ess/notifications',
    '/ess/profile',
    '/ess/documents',
    '/ess/credentials',
    '/ess/disciplinary',
    '/ess/grievances',
    '/ess/hse',
    '/ess/assets',
    '/ess/performance',
  ],
};

export type EssHubTileDef = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  module: ModuleKey | 'ess';
  badgeKey?: string;
};

export const ESS_WORK_HUB_TILES: EssHubTileDef[] = [
  {
    href: '/ess/leave',
    label: 'Leave',
    description: 'Balances, requests, and history',
    icon: CalendarDays,
    module: 'leave',
    badgeKey: 'leavePending',
  },
  {
    href: '/ess/attendance',
    label: 'Time & attendance',
    description: 'Monthly summary and clock in',
    icon: Clock3,
    module: 'time',
    badgeKey: 'attendancePending',
  },
  {
    href: '/ess/rota',
    label: 'My rota',
    description: 'Upcoming shifts',
    icon: Fingerprint,
    module: 'time',
  },
  {
    href: '/ess/onboarding',
    label: 'Onboarding',
    description: 'Tasks and checklist',
    icon: ListTodo,
    module: 'core',
    badgeKey: 'onboardingDue',
  },
];

export const ESS_PAY_HUB_TILES: EssHubTileDef[] = [
  {
    href: '/ess/payslips',
    label: 'Payslips',
    description: 'View and download payslips',
    icon: Receipt,
    module: 'payroll',
  },
  {
    href: '/ess/pay/ytd',
    label: 'Year to date',
    description: 'Earnings and deductions summary',
    icon: Landmark,
    module: 'payroll',
  },
  {
    href: '/ess/pay/tax-certificates',
    label: 'Tax certificates',
    description: 'Annual tax documents',
    icon: FileText,
    module: 'payroll',
  },
  {
    href: '/ess/pay/bank-details',
    label: 'Bank details',
    description: 'View or request a change',
    icon: Wallet,
    module: 'payroll',
  },
];

export const ESS_TEAM_HUB_TILES: EssHubTileDef[] = [
  {
    href: '/ess/team/leave',
    label: 'Leave approvals',
    description: 'Review team leave requests',
    icon: CalendarDays,
    module: 'leave',
    badgeKey: 'teamLeavePending',
  },
  {
    href: '/ess/team/calendar',
    label: 'Team calendar',
    description: 'Who is on leave this week',
    icon: Users,
    module: 'leave',
  },
  {
    href: '/ess/team/attendance',
    label: 'Attendance exceptions',
    description: 'Pending reviews for your team',
    icon: Clock3,
    module: 'time',
    badgeKey: 'teamAttendancePending',
  },
];

export type EssMoreGroup = {
  title: string;
  items: EssHubTileDef[];
};

export const ESS_MORE_GROUPS: EssMoreGroup[] = [
  {
    title: 'Account',
    items: [
      {
        href: '/ess/profile',
        label: 'Profile',
        description: 'Contact details and job info',
        icon: User,
        module: 'ess',
      },
      {
        href: '/ess/profile/emergency',
        label: 'Emergency contacts',
        description: 'People to call in an emergency',
        icon: Users,
        module: 'ess',
      },
      {
        href: '/ess/account-security',
        label: 'Security',
        description: 'Password and sign-in',
        icon: Shield,
        module: 'ess',
      },
      {
        href: '/ess/install',
        label: 'Install app',
        description: 'Add to your home screen',
        icon: Home,
        module: 'ess',
      },
    ],
  },
  {
    title: 'My records',
    items: [
      {
        href: '/ess/documents',
        label: 'Documents',
        description: 'Contracts and HR letters',
        icon: FileText,
        module: 'core',
      },
      {
        href: '/ess/credentials',
        label: 'Credentials',
        description: 'Licences and certifications',
        icon: BadgeCheck,
        module: 'core',
        badgeKey: 'credentialsExpiring',
      },
      {
        href: '/ess/assets',
        label: 'My assets',
        description: 'Assigned equipment and kit',
        icon: Package,
        module: 'assets',
      },
    ],
  },
  {
    title: 'Workplace',
    items: [
      {
        href: '/ess/performance',
        label: 'Performance',
        description: 'Goals and review cycles',
        icon: Target,
        module: 'performance',
      },
      {
        href: '/ess/disciplinary',
        label: 'Disciplinary',
        description: 'Cases and letters',
        icon: Shield,
        module: 'disciplinary',
      },
      {
        href: '/ess/grievances',
        label: 'Grievances',
        description: 'Raise or track a grievance',
        icon: Briefcase,
        module: 'disciplinary',
      },
      {
        href: '/ess/hse',
        label: 'Health & safety',
        description: 'Report or view incidents',
        icon: ShieldAlert,
        module: 'hse',
      },
    ],
  },
];

export function resolveEssActiveTab(pathname: string): EssTabId {
  const path = pathname.split('?')[0] || pathname;
  if (path === '/ess' || path === '/ess/') return 'home';

  const checks: EssTabId[] = ['team', 'pay', 'work', 'more', 'home'];
  for (const tab of checks) {
    const prefixes = ESS_TAB_ACTIVE_PREFIXES[tab];
    if (prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return tab;
  }
  return 'home';
}

export function showEssTeamTab(role: string | undefined): boolean {
  return role === 'manager' || role === 'hr';
}
