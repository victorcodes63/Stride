import {
  attentionItem,
  type AttentionContributor,
} from '@/lib/dashboard-attention/types';

/** Platform — unread inbox (cross-cutting). */
export const platformAdminAttentionContributor: AttentionContributor = {
  domainId: 'platform-admin',
  contribute(ctx) {
    if (ctx.unreadNotifications <= 0) return [];

    return [
      attentionItem('platform-admin', {
        id: 'notifications',
        label: 'Notifications',
        detail: `${ctx.unreadNotifications} unread update${
          ctx.unreadNotifications === 1 ? '' : 's'
        }`,
        href: '/dashboard/notifications',
        tone: 'neutral',
      }),
    ];
  },
};
