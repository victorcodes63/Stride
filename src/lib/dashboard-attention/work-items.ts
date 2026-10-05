import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import type { OverviewAttentionTone } from '@/lib/dashboard-attention/types';

/** Stable queue keys — match category ids from overview contributors. */
export type AttentionQueueId =
  | 'leave'
  | 'attendance'
  | 'onboarding'
  | 'invoices'
  | 'vendor-bills'
  | 'purchase-requests'
  | 'fleet-incidents'
  | 'sales-past-due'
  | 'sales-stalled'
  | 'credentials';

export type AttentionActionKind =
  | 'approve'
  | 'reject'
  | 'resolve'
  | 'ignore'
  | 'record_payment'
  | 'nudge_close'
  | 'log_activity'
  | 'mark_renewed'
  | 'acknowledge'
  | 'complete';

export type AttentionAction = {
  id: AttentionActionKind;
  label: string;
  /** Destructive / secondary styling hint */
  variant?: 'primary' | 'secondary' | 'danger';
  /** When true, Action Center shows a note/reason field before submit */
  requiresNote?: boolean;
  /** When true, shows payment amount/method/date fields */
  requiresPayment?: boolean;
};

export type AttentionWorkItem = {
  id: string;
  queueId: AttentionQueueId;
  domainId: DashboardModuleDomainId;
  title: string;
  detail: string;
  tone: OverviewAttentionTone;
  href: string;
  entityType: string;
  entityId: string;
  actions: AttentionAction[];
  meta?: Record<string, unknown>;
};

export type AttentionQueueSummary = {
  total: number;
  critical: number;
  byQueue: Partial<Record<AttentionQueueId, number>>;
};

export const ATTENTION_QUEUE_CAP = 25;

export function toneRank(tone: OverviewAttentionTone): number {
  if (tone === 'rose') return 0;
  if (tone === 'amber') return 1;
  if (tone === 'sky') return 2;
  return 3;
}

export function sortWorkItems(items: AttentionWorkItem[]): AttentionWorkItem[] {
  return [...items].sort((a, b) => toneRank(a.tone) - toneRank(b.tone) || a.title.localeCompare(b.title));
}

export function summarizeWorkItems(items: AttentionWorkItem[]): AttentionQueueSummary {
  const byQueue: Partial<Record<AttentionQueueId, number>> = {};
  let critical = 0;
  for (const item of items) {
    byQueue[item.queueId] = (byQueue[item.queueId] ?? 0) + 1;
    if (item.tone === 'rose') critical += 1;
  }
  return { total: items.length, critical, byQueue };
}
