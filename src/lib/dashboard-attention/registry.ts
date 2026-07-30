import type {
  AttentionContributor,
  AttentionContributorContext,
  OverviewAttentionItem,
} from '@/lib/dashboard-attention/types';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';

const contributors: AttentionContributor[] = [];
const byDomain = new Map<DashboardModuleDomainId, AttentionContributor>();

/** Register a domain’s urgency contributor. Later registrations for the same domain replace earlier ones. */
export function registerAttentionContributor(contributor: AttentionContributor): void {
  const existing = byDomain.get(contributor.domainId);
  if (existing) {
    const index = contributors.indexOf(existing);
    if (index >= 0) contributors.splice(index, 1);
  }
  byDomain.set(contributor.domainId, contributor);
  contributors.push(contributor);
}

export function listAttentionContributors(): readonly AttentionContributor[] {
  return contributors;
}

/** Collect urgency items from every registered domain contributor. */
export function collectAttentionItems(ctx: AttentionContributorContext): OverviewAttentionItem[] {
  const items: OverviewAttentionItem[] = [];
  for (const contributor of contributors) {
    const owned = contributor.contribute(ctx);
    for (const item of owned) {
      // Enforce domain ownership so a contributor cannot leak into another column.
      items.push(
        item.domainId === contributor.domainId
          ? item
          : { ...item, domainId: contributor.domainId },
      );
    }
  }
  return items;
}

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
