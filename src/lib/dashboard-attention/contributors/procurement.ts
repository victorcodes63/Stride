import {
  attentionItem,
  moduleOn,
  type AttentionContributor,
  type OverviewAttentionItem,
} from '@/lib/dashboard-attention/types';

/** Procurement — vendor bills + purchase requests. */
export const procurementAttentionContributor: AttentionContributor = {
  domainId: 'procurement',
  contribute(ctx) {
    const cross = ctx.crossModule;
    if (!cross) return [];
    const items: OverviewAttentionItem[] = [];

    if (moduleOn(ctx, 'accounts') && cross.vendorBillsOutstanding > 0) {
      items.push(
        attentionItem('procurement', {
          id: 'vendor-bills',
          label: 'Vendor bills',
          detail: `${cross.vendorBillsOutstanding} bill${
            cross.vendorBillsOutstanding === 1 ? '' : 's'
          } to pay or approve`,
          href: '/dashboard/accounts/vendor-bills?status=unpaid',
          tone: 'amber',
        }),
      );
    }

    if (moduleOn(ctx, 'core') && cross.pendingPurchaseRequests > 0) {
      items.push(
        attentionItem('procurement', {
          id: 'purchase-requests',
          label: 'Purchase requests',
          detail: `${cross.pendingPurchaseRequests} awaiting approval`,
          href: '/dashboard/procurement/purchase-requests?status=submitted',
          tone: 'amber',
        }),
      );
    }

    return items;
  },
};
