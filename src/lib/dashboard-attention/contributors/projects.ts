import type { AttentionContributor } from '@/lib/dashboard-attention/types';

/** Projects — no overview urgency signals yet; own this file when adding them. */
export const projectsAttentionContributor: AttentionContributor = {
  domainId: 'projects',
  contribute() {
    return [];
  },
};
