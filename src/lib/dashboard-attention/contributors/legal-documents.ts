import {
  attentionItem,
  moduleOn,
  type AttentionContributor,
} from '@/lib/dashboard-attention/types';

/** Legal & Documents — credential compliance. */
export const legalDocumentsAttentionContributor: AttentionContributor = {
  domainId: 'legal-documents',
  contribute(ctx) {
    if (!moduleOn(ctx, 'core')) return [];
    if (ctx.credentialsExpiring <= 0 && ctx.credentialsExpired <= 0) return [];

    return [
      attentionItem('legal-documents', {
        id: 'credentials',
        label: 'Credentials',
        detail: [
          ctx.credentialsExpiring > 0 ? `${ctx.credentialsExpiring} expiring soon` : null,
          ctx.credentialsExpired > 0 ? `${ctx.credentialsExpired} expired` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        href:
          ctx.credentialsExpired > 0
            ? '/dashboard/credentials?status=expired'
            : '/dashboard/credentials?status=expiring_soon',
        tone: 'amber',
      }),
    ];
  },
};
