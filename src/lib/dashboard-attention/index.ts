import { ensureAttentionContributorsRegistered } from '@/lib/dashboard-attention/contributors';
import {
  collectAttentionItems,
  groupAttentionByDomain,
  listAttentionContributors,
  registerAttentionContributor,
} from '@/lib/dashboard-attention/registry';
import type {
  AttentionContributor,
  AttentionContributorContext,
  AttentionPersona,
  OverviewAttentionItem,
  OverviewAttentionTone,
} from '@/lib/dashboard-attention/types';
import { attentionItem, moduleOn } from '@/lib/dashboard-attention/types';

ensureAttentionContributorsRegistered();

export type {
  AttentionContributor,
  AttentionContributorContext,
  AttentionPersona,
  OverviewAttentionItem,
  OverviewAttentionTone,
};

export {
  attentionItem,
  collectAttentionItems,
  groupAttentionByDomain,
  listAttentionContributors,
  moduleOn,
  registerAttentionContributor,
};

/** Public entry used by the overview home — domains contribute via the registry. */
export function buildAttentionItems(ctx: AttentionContributorContext): OverviewAttentionItem[] {
  ensureAttentionContributorsRegistered();
  return collectAttentionItems(ctx);
}
