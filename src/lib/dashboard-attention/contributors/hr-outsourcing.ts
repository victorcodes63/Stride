import type { AttentionContributor } from '@/lib/dashboard-attention/types';

/** HR Outsourcing — no overview urgency signals yet; own this file when adding them. */
export const hrOutsourcingAttentionContributor: AttentionContributor = {
  domainId: 'hr-outsourcing',
  contribute() {
    return [];
  },
};
