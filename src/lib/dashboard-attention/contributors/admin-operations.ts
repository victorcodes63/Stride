import type { AttentionContributor } from '@/lib/dashboard-attention/types';

/** Admin Operations — no overview urgency signals yet; own this file when adding them. */
export const adminOperationsAttentionContributor: AttentionContributor = {
  domainId: 'admin-operations',
  contribute() {
    return [];
  },
};
