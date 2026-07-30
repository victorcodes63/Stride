import {
  attentionItem,
  moduleOn,
  type AttentionContributor,
} from '@/lib/dashboard-attention/types';

/** Fleet & Logistics — open incidents. */
export const fleetLogisticsAttentionContributor: AttentionContributor = {
  domainId: 'fleet-logistics',
  contribute(ctx) {
    const cross = ctx.crossModule;
    if (!moduleOn(ctx, 'fleet') || !cross || cross.openFleetIncidents <= 0) return [];

    return [
      attentionItem('fleet-logistics', {
        id: 'fleet-incidents',
        label: 'Fleet incidents',
        detail: `${cross.openFleetIncidents} open incident${
          cross.openFleetIncidents === 1 ? '' : 's'
        }`,
        href: '/dashboard/fleet/compliance',
        tone: 'rose',
      }),
    ];
  },
};
