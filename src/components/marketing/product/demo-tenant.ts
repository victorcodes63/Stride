/**
 * One fictional demo company for every product preview on the marketing site.
 *
 * Rules (keep them when you add data):
 * - Counts and statuses only — never money, never named real customers.
 * - The same 120-person team everywhere (matches /platform and the homepage).
 * - Wording mirrors the dashboard's own attention contributors and snapshot lines,
 *   so previews read exactly like the product.
 */
import type { DashboardModuleDomain, DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { DASHBOARD_MODULE_DOMAINS } from '@/lib/dashboard-module-domains';
import type { OverviewAttentionItem } from '@/lib/dashboard-attention/types';
import type { OverviewDomainSnapshot, OverviewKpiChartSegment } from '@/lib/dashboard-overview-personalization';

export const DEMO_TEAM_SIZE = 120;

/** Modules switched on for the demo tenant (core + two plug-ins + one industry pack). */
const DEMO_DOMAIN_IDS: DashboardModuleDomainId[] = [
  'hr-payroll',
  'finance',
  'procurement',
  'legal-documents',
  'projects',
  'fleet-logistics',
];

export const DEMO_DOMAINS: DashboardModuleDomain[] = DEMO_DOMAIN_IDS.map(
  (id) => DASHBOARD_MODULE_DOMAINS.find((d) => d.id === id)!,
).filter(Boolean);

export const DEMO_ATTENTION_ITEMS: OverviewAttentionItem[] = [
  {
    id: 'leave',
    label: 'Leave approvals',
    detail: '4 requests awaiting action',
    href: '#',
    tone: 'amber',
    domainId: 'hr-payroll',
  },
  {
    id: 'attendance',
    label: 'Attendance exceptions',
    detail: '3 open, review clock data',
    href: '#',
    tone: 'rose',
    domainId: 'hr-payroll',
  },
  {
    id: 'onboarding',
    label: 'Onboarding tasks',
    detail: '2 assigned to you',
    href: '#',
    tone: 'sky',
    domainId: 'hr-payroll',
  },
  {
    id: 'invoices',
    label: 'Unpaid invoices',
    detail: '6 invoices outstanding',
    href: '#',
    tone: 'amber',
    domainId: 'finance',
  },
  {
    id: 'purchase-requests',
    label: 'Purchase requests',
    detail: '2 awaiting approval',
    href: '#',
    tone: 'sky',
    domainId: 'procurement',
  },
  {
    id: 'credentials',
    label: 'Credentials',
    detail: '1 expiring in 30 days',
    href: '#',
    tone: 'amber',
    domainId: 'legal-documents',
  },
  {
    id: 'fleet-incidents',
    label: 'Fleet incidents',
    detail: '1 open incident',
    href: '#',
    tone: 'rose',
    domainId: 'fleet-logistics',
  },
];

export function demoAttentionByDomain(
  items: OverviewAttentionItem[] = DEMO_ATTENTION_ITEMS,
): Partial<Record<DashboardModuleDomainId, OverviewAttentionItem[]>> {
  const grouped: Partial<Record<DashboardModuleDomainId, OverviewAttentionItem[]>> = {};
  for (const item of items) {
    (grouped[item.domainId] ??= []).push(item);
  }
  return grouped;
}

export const DEMO_DOMAIN_SNAPSHOTS: OverviewDomainSnapshot[] = [
  { domainId: 'hr-payroll', lines: [`${DEMO_TEAM_SIZE} staff`, '112 on duty today'] },
  { domainId: 'finance', lines: ['6 unpaid invoices'] },
  { domainId: 'procurement', lines: ['2 PRs awaiting approval'] },
  { domainId: 'legal-documents', lines: ['All contracts current'] },
  { domainId: 'projects', lines: ['4 active projects on track'] },
  { domainId: 'fleet-logistics', lines: ['9 trips in transit'] },
];

export type DemoKpi = {
  label: string;
  value: number | string;
  note: string;
  domainId: DashboardModuleDomainId;
  segments: OverviewKpiChartSegment[];
};

/** "Across the business" KPI cards — weekly counts for the demo team. */
export const DEMO_KPIS: DemoKpi[] = [
  {
    label: 'On duty',
    value: 112,
    note: `of ${DEMO_TEAM_SIZE} staff today`,
    domainId: 'hr-payroll',
    segments: [
      { label: 'Mon', value: 116, tone: 'primary' },
      { label: 'Tue', value: 114, tone: 'primary' },
      { label: 'Wed', value: 117, tone: 'primary' },
      { label: 'Thu', value: 112, tone: 'primary' },
      { label: 'Fri', value: 112, tone: 'primary' },
    ],
  },
  {
    label: 'Leave',
    value: 4,
    note: 'requests pending',
    domainId: 'hr-payroll',
    segments: [
      { label: 'Approved', value: 9, tone: 'emerald' },
      { label: 'Pending', value: 4, tone: 'amber' },
      { label: 'Declined', value: 1, tone: 'muted' },
    ],
  },
  {
    label: 'Invoices',
    value: 6,
    note: 'unpaid this month',
    domainId: 'finance',
    segments: [
      { label: 'Paid', value: 18, tone: 'emerald' },
      { label: 'Due', value: 4, tone: 'amber' },
      { label: 'Overdue', value: 2, tone: 'rose' },
    ],
  },
  {
    label: 'Trips',
    value: 9,
    note: 'in transit now',
    domainId: 'fleet-logistics',
    segments: [
      { label: 'Planned', value: 5, tone: 'muted' },
      { label: 'Transit', value: 9, tone: 'primary' },
      { label: 'Done', value: 14, tone: 'emerald' },
    ],
  },
];
