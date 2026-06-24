import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Building2,
  ClipboardList,
  FileSignature,
  Gavel,
  Landmark,
  LayoutGrid,
  Scale,
  ShoppingCart,
  Smartphone,
} from 'lucide-react';
import type { NavReadiness } from '@/lib/dashboard-nav-readiness';

export type RoadmapRelatedLink = {
  label: string;
  href: string;
  note?: string;
};

export type RoadmapPageConfig = {
  slug: string;
  title: string;
  icon: LucideIcon;
  readiness: NavReadiness;
  phase: string;
  summary: string;
  bullets: string[];
  related?: RoadmapRelatedLink[];
};

export const ROADMAP_PAGES: Record<string, RoadmapPageConfig> = {
  procurement: {
    slug: 'procurement',
    title: 'Procurement',
    icon: ShoppingCart,
    readiness: 'planned',
    phase: 'Phase C — Procurement module',
    summary:
      'Full purchase-to-pay: requests, approvals, LPO generation, goods receipt, and spend visibility. Vendor master today lives under Finance until this module ships.',
    bullets: [
      'Purchase request workflow with multi-step approvals',
      'LPO PDF generation and vendor dispatch',
      'Goods receipt and three-way match to vendor bills',
      'Department spend dashboard vs budget',
    ],
    related: [
      { label: 'Vendors (Finance)', href: '/dashboard/accounts/vendors', note: 'Live today' },
      { label: 'Vendor bills', href: '/dashboard/accounts/vendor-bills', note: 'Live today' },
      { label: 'Expense claims', href: '/dashboard/accounts/expenses', note: 'Approvals pattern' },
    ],
  },
  'procurement-purchase-requests': {
    slug: 'procurement-purchase-requests',
    title: 'Purchase requests',
    icon: ClipboardList,
    readiness: 'planned',
    phase: 'Phase C1',
    summary: 'Staff and managers raise purchase requests that route through approval before an LPO is issued.',
    bullets: ['ESS submit from mobile', 'Budget check at request time', 'Audit trail per line item'],
    related: [{ label: 'Procurement overview', href: '/dashboard/procurement' }],
  },
  'procurement-lpos': {
    slug: 'procurement-lpos',
    title: 'LPO register',
    icon: FileSignature,
    readiness: 'planned',
    phase: 'Phase C2',
    summary: 'Local purchase orders generated from approved requests, with numbering and PDF templates.',
    bullets: ['Sequential LPO numbering', 'Vendor email dispatch', 'Link to vendor bill on receipt'],
    related: [{ label: 'Procurement overview', href: '/dashboard/procurement' }],
  },
  'procurement-spend': {
    slug: 'procurement-spend',
    title: 'Spend dashboard',
    icon: Scale,
    readiness: 'partial',
    phase: 'Phase C3 / Finance',
    summary:
      'Consolidated spend view is planned here. Until then, use vendor bills and financial reports for AP spend.',
    bullets: ['Vendor spend by period', 'Department allocation', 'Budget burn alerts'],
    related: [
      { label: 'Vendor bills', href: '/dashboard/accounts/vendor-bills' },
      { label: 'Budgets', href: '/dashboard/accounts/budgets', note: 'Partial' },
      { label: 'Financial reports', href: '/dashboard/accounts/financial-reports' },
    ],
  },
  projects: {
    slug: 'projects',
    title: 'Projects',
    icon: Briefcase,
    readiness: 'planned',
    phase: 'Phase D — Projects module',
    summary:
      'Track deliverables, assign tasks, and compare budgets to payroll, AP, and expense actuals. Construction vertical depends on this module.',
    bullets: [
      'Project charter, milestones, and task board',
      'Team allocation from employee directory',
      'Budget vs actual from Finance + Payroll',
    ],
    related: [{ label: 'Budgets (Finance)', href: '/dashboard/accounts/budgets', note: 'Partial — not project-scoped yet' }],
  },
  'projects-board': {
    slug: 'projects-board',
    title: 'Project board',
    icon: LayoutGrid,
    readiness: 'planned',
    phase: 'Phase D2',
    summary: 'Kanban and list views across active projects with status, owner, and due dates.',
    bullets: ['Filter by department or client', 'Link tasks to onboarding checklists where relevant'],
    related: [{ label: 'Projects overview', href: '/dashboard/projects' }],
  },
  'projects-tasks': {
    slug: 'projects-tasks',
    title: 'Tasks & deliverables',
    icon: ClipboardList,
    readiness: 'planned',
    phase: 'Phase D2',
    summary: 'Task assignments, dependencies, and completion tracking tied to project milestones.',
    bullets: ['Manager assign from roster', 'ESS task inbox for field staff', 'Export for client reporting'],
    related: [
      { label: 'Onboarding tasks', href: '/dashboard/onboarding', note: 'HR tasks — live' },
      { label: 'Projects overview', href: '/dashboard/projects' },
    ],
  },
  legal: {
    slug: 'legal',
    title: 'Legal & compliance hub',
    icon: Gavel,
    readiness: 'partial',
    phase: 'Phase B — Legal surface',
    summary:
      'Unified entry for contracts, statutory credentials, company policies, and (soon) a legal obligations register.',
    bullets: [
      'Contract renewal reminders — live under People',
      'Credential expiry tracking — live',
      'Company policy library — live',
      'Obligation register — planned',
    ],
    related: [
      { label: 'Contracts', href: '/dashboard/people/contracts' },
      { label: 'Credentials', href: '/dashboard/credentials' },
      { label: 'Company documents', href: '/dashboard/company-documents' },
    ],
  },
  'legal-obligations': {
    slug: 'legal-obligations',
    title: 'Obligations register',
    icon: Scale,
    readiness: 'planned',
    phase: 'Phase B4',
    summary:
      'Track licences, permits, filings, and renewal obligations with owners, due dates, and evidence documents.',
    bullets: ['Extends contracts + credentials', 'Board and regulator deadlines', 'Email escalation before due date'],
    related: [
      { label: 'Legal hub', href: '/dashboard/legal' },
      { label: 'Credentials', href: '/dashboard/credentials', note: 'Live subset' },
    ],
  },
  'payroll-disbursements': {
    slug: 'payroll-disbursements',
    title: 'M-Pesa & disbursements',
    icon: Smartphone,
    readiness: 'planned',
    phase: 'Phase A1',
    summary:
      'Bulk salary disbursement via M-Pesa and bank APIs, with per-employee payment status on the payroll run. Bank file export is available today.',
    bullets: [
      'M-Pesa B2C bulk disbursement',
      'Payment reconciliation to payroll run',
      'Failed payment retry workflow',
    ],
    related: [
      { label: 'Payroll runs', href: '/dashboard/payroll' },
      { label: 'Payslips', href: '/dashboard/payroll/payslips' },
    ],
  },
  'admin-facilities': {
    slug: 'admin-facilities',
    title: 'Facilities',
    icon: Building2,
    readiness: 'planned',
    phase: 'Phase E1',
    summary: 'Sites, leases, and light maintenance ticketing for property and facilities teams.',
    bullets: ['Site / branch register', 'Lease renewal dates', 'Maintenance request queue'],
    related: [{ label: 'Assets', href: '/dashboard/assets', note: 'Live — equipment register' }],
  },
  'admin-governance': {
    slug: 'admin-governance',
    title: 'Board & governance',
    icon: Landmark,
    readiness: 'planned',
    phase: 'Phase E2',
    summary: 'Board resolutions, meeting minutes, and action tracking for regulated and SACCO clients.',
    bullets: ['Resolution register with status', 'Action owners and due dates', 'PDF minute pack export'],
    related: [{ label: 'Audit log', href: '/dashboard/admin/audit-log', note: 'Live — system audit' }],
  },
};

export function getRoadmapPageConfig(slug: string): RoadmapPageConfig | null {
  return ROADMAP_PAGES[slug] ?? null;
}

/** Map pathname to roadmap config slug. */
export function roadmapSlugFromPath(pathname: string): string | null {
  const path = pathname.split('?')[0] ?? pathname;
  const map: Record<string, string> = {
    '/dashboard/procurement': 'procurement',
    '/dashboard/procurement/purchase-requests': 'procurement-purchase-requests',
    '/dashboard/procurement/lpos': 'procurement-lpos',
    '/dashboard/procurement/spend': 'procurement-spend',
    '/dashboard/projects': 'projects',
    '/dashboard/projects/board': 'projects-board',
    '/dashboard/projects/tasks': 'projects-tasks',
    '/dashboard/legal': 'legal',
    '/dashboard/legal/obligations': 'legal-obligations',
    '/dashboard/payroll/disbursements': 'payroll-disbursements',
    '/dashboard/admin/facilities': 'admin-facilities',
    '/dashboard/admin/governance': 'admin-governance',
  };
  return map[path] ?? null;
}
