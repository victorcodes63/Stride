/**
 * Implementation readiness for dashboard nav items — surfaces partial / planned work in the sidebar.
 */

export type NavReadiness = 'live' | 'partial' | 'mock' | 'planned';

export const NAV_READINESS_META: Record<
  NavReadiness,
  { label: string; className: string; title: string }
> = {
  live: {
    label: '',
    className: '',
    title: 'Available',
  },
  partial: {
    label: 'Partial',
    className:
      'dash-readiness-badge bg-[var(--dash-surface-raised)] text-[var(--dash-text-muted)] ring-1 ring-[var(--dash-border)]',
    title: 'Partially implemented — some features still on the roadmap',
  },
  mock: {
    label: 'Demo',
    className:
      'dash-readiness-badge bg-[var(--dash-surface-raised)] text-[var(--dash-text-muted)] ring-1 ring-[var(--dash-border)]',
    title: 'Demo / prototype UI — not yet backed by production data',
  },
  planned: {
    label: 'Soon',
    className:
      'bg-[var(--dash-surface-raised)] text-[var(--dash-text-muted)] ring-1 ring-[var(--dash-border)]',
    title: 'On the product roadmap — placeholder page for now',
  },
};

/** Per-route readiness. Omitted routes default to live. */
export const NAV_ITEM_READINESS: Record<string, NavReadiness> = {
  // HR & Payroll
  '/dashboard/performance': 'mock',
  '/dashboard/payroll/disbursements': 'planned',

  // Finance
  '/dashboard/accounts/statements': 'partial',
  '/dashboard/accounts/budgets': 'partial',

  // Procurement
  '/dashboard/procurement': 'partial',
  '/dashboard/procurement/purchase-requests': 'partial',
  '/dashboard/procurement/lpos': 'planned',
  '/dashboard/procurement/spend': 'partial',

  // Legal
  '/dashboard/legal': 'partial',
  '/dashboard/people/contracts': 'partial',
  '/dashboard/legal/obligations': 'planned',

  // Projects
  '/dashboard/projects': 'planned',
  '/dashboard/projects/board': 'planned',
  '/dashboard/projects/tasks': 'planned',

  // Admin & Operations
  '/dashboard/hse': 'mock',
  '/dashboard/admin/facilities': 'planned',
  '/dashboard/admin/governance': 'planned',
  '/dashboard/fleet/vehicles': 'partial',
};

export function getNavItemReadiness(href: string): NavReadiness {
  const base = href.split('?')[0] ?? href;
  return NAV_ITEM_READINESS[base] ?? 'live';
}

export function domainReadinessDotClass(readiness: NavReadiness | 'live' | 'partial' | 'planned'): string {
  switch (readiness) {
    case 'live':
      return 'bg-emerald-500';
    case 'partial':
    case 'mock':
      return 'bg-amber-500';
    case 'planned':
      return 'bg-neutral-300';
    default:
      return 'bg-neutral-300';
  }
}
