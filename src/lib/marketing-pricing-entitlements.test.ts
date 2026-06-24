import { describe, expect, it } from 'vitest';
import {
  MARKETING_TIER_ENTITLEMENTS,
  marketingTierModuleSummary,
} from '@/lib/marketing-pricing-entitlements';

describe('marketing-pricing-entitlements', () => {
  it('maps tiers to control-plane planIds', () => {
    expect(MARKETING_TIER_ENTITLEMENTS.starter.planId).toBe('starter');
    expect(MARKETING_TIER_ENTITLEMENTS.growth.planId).toBe('growth');
    expect(MARKETING_TIER_ENTITLEMENTS.enterprise.planId).toBe('enterprise');
  });

  it('starter excludes vertical engines', () => {
    expect(MARKETING_TIER_ENTITLEMENTS.starter.verticalEngines).toBe(false);
    expect(MARKETING_TIER_ENTITLEMENTS.growth.verticalEngines).toBe(true);
  });

  it('enterprise includes performance module', () => {
    expect(MARKETING_TIER_ENTITLEMENTS.enterprise.includedModules).toContain('performance');
    expect(MARKETING_TIER_ENTITLEMENTS.starter.includedModules).not.toContain('performance');
  });

  it('pricing page summaries are non-empty', () => {
    for (const id of ['starter', 'growth', 'enterprise'] as const) {
      expect(marketingTierModuleSummary(id).length).toBeGreaterThan(3);
    }
  });
});
