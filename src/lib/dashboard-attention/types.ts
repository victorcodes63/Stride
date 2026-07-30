import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import type { OverviewCrossModuleMetrics } from '@/lib/dashboard-overview-metrics';
import type { ModuleKey } from '@/lib/modules';

/** Matches overview persona labels used for attention gating. */
export type AttentionPersona =
  | 'admin'
  | 'director'
  | 'finance'
  | 'business_manager'
  | 'operations'
  | 'viewer';

export type OverviewAttentionTone = 'amber' | 'rose' | 'sky' | 'neutral';

export type OverviewAttentionItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: OverviewAttentionTone;
  domainId: DashboardModuleDomainId;
};

/** Shared metrics + session context passed to every domain contributor. */
export type AttentionContributorContext = {
  pendingLeave: number;
  openAttendanceExceptions: number;
  credentialsExpiring: number;
  credentialsExpired: number;
  myOnboardingCount: number;
  unreadNotifications: number;
  crossModule?: OverviewCrossModuleMetrics;
  persona: AttentionPersona;
  modules: Partial<Record<ModuleKey, boolean>>;
};

/**
 * One contributor per product domain.
 * Domains own their urgency rules — add items here instead of a central switch.
 */
export type AttentionContributor = {
  domainId: DashboardModuleDomainId;
  contribute: (ctx: AttentionContributorContext) => OverviewAttentionItem[];
};

export function moduleOn(ctx: AttentionContributorContext, key: ModuleKey): boolean {
  return ctx.modules[key] === true;
}

export function attentionItem(
  domainId: DashboardModuleDomainId,
  item: Omit<OverviewAttentionItem, 'domainId'>,
): OverviewAttentionItem {
  return { ...item, domainId };
}
