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
  '/dashboard/performance': 'live',
  '/dashboard/payroll/disbursements': 'partial',

  // Finance
  '/dashboard/accounts/statements': 'live',
  '/dashboard/accounts/budgets': 'partial',

  // Procurement
  '/dashboard/procurement': 'live',
  '/dashboard/procurement/purchase-requests': 'live',
  '/dashboard/procurement/lpos': 'live',
  '/dashboard/procurement/spend': 'live',

  // Legal
  '/dashboard/legal': 'live',
  '/dashboard/people/contracts': 'partial',
  '/dashboard/legal/obligations': 'live',
  '/dashboard/accounts/mpesa-reconciliation': 'live',

  // Projects
  '/dashboard/projects': 'live',
  '/dashboard/projects/all': 'live',
  '/dashboard/projects/board': 'live',
  '/dashboard/projects/tasks': 'live',
  '/dashboard/projects/budget': 'live',

  // Admin & Operations
  '/dashboard/hse': 'live',
  '/dashboard/admin/facilities': 'live',
  '/dashboard/admin/governance': 'live',
  '/dashboard/fleet/vehicles': 'live',
  '/dashboard/fleet/registers': 'live',
  '/dashboard/sacco': 'live',
  '/dashboard/sacco/members': 'live',
  '/dashboard/sacco/accounts': 'live',
  '/dashboard/sacco/dividends': 'live',
  '/dashboard/sacco/reports': 'live',
  '/dashboard/healthcare': 'live',
  '/dashboard/healthcare/wards': 'live',
  '/dashboard/healthcare/rota': 'live',
  '/dashboard/healthcare/nhif': 'live',
  '/dashboard/energy': 'live',
  '/dashboard/energy/sites': 'live',
  '/dashboard/energy/permits': 'live',
  '/dashboard/energy/hse': 'live',
  '/dashboard/construction': 'live',
  '/dashboard/construction/sites': 'live',
  '/dashboard/construction/plant': 'live',
  '/dashboard/construction/subcontractors': 'live',
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
