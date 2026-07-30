import {
  attentionItem,
  moduleOn,
  type AttentionContributor,
  type OverviewAttentionItem,
} from '@/lib/dashboard-attention/types';

/** Sales — past-due closes + stalled deals. */
export const salesAttentionContributor: AttentionContributor = {
  domainId: 'sales',
  contribute(ctx) {
    const cross = ctx.crossModule;
    if (!moduleOn(ctx, 'sales') || !cross) return [];
    const items: OverviewAttentionItem[] = [];

    if (cross.salesPastDueCloses > 0) {
      items.push(
        attentionItem('sales', {
          id: 'sales-past-due',
          label: 'Past-due closes',
          detail: `${cross.salesPastDueCloses} open deal${
            cross.salesPastDueCloses === 1 ? '' : 's'
          } past expected close`,
          href: '/dashboard/sales/deals',
          tone: 'rose',
        }),
      );
    }

    if (cross.salesStalledDeals > 0) {
      items.push(
        attentionItem('sales', {
          id: 'sales-stalled',
          label: 'Stalled deals',
          detail: `${cross.salesStalledDeals} with no movement in 14+ days`,
          href: '/dashboard/sales/deals',
          tone: 'amber',
        }),
      );
    }

    return items;
  },
};
