import {
  attentionItem,
  moduleOn,
  type AttentionContributor,
} from '@/lib/dashboard-attention/types';

/** Finance — unpaid invoices. */
export const financeAttentionContributor: AttentionContributor = {
  domainId: 'finance',
  contribute(ctx) {
    const cross = ctx.crossModule;
    if (!moduleOn(ctx, 'accounts') || !cross || cross.invoicesOutstanding <= 0) return [];

    return [
      attentionItem('finance', {
        id: 'invoices',
        label: 'Unpaid invoices',
        detail: `${cross.invoicesOutstanding} invoice${
          cross.invoicesOutstanding === 1 ? '' : 's'
        } awaiting payment`,
        href: '/dashboard/accounts/invoices?status=unpaid',
        tone: 'amber',
      }),
    ];
  },
};
