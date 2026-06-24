/**
 * Maps public marketing tiers to deployment entitlements (ENTITLEMENT-SYNC + modules.ts).
 * Used on /pricing and in sales copy — keep aligned with control-plane planId values.
 */
import type { DeploymentTier } from '@/lib/deployment-tier';
import type { ModuleKey } from '@/lib/modules';

export type MarketingPricingTierId = DeploymentTier;

export type MarketingTierEntitlement = {
  planId: MarketingPricingTierId;
  maxEmployees: number | null;
  /** Module keys included at this tier (env MODULE_* must also be true). */
  includedModules: ModuleKey[];
  verticalEngines: boolean;
  multiEntity: boolean;
  companySetup: boolean;
};

const STARTER_MODULES: ModuleKey[] = ['core', 'leave', 'time', 'payroll', 'accounts', 'ess'];

const GROWTH_MODULES: ModuleKey[] = [
  ...STARTER_MODULES,
  'ats',
  'reports',
  'documents',
  'training',
  'communications',
  'disciplinary',
  'procurement',
  'legal',
  'assets',
  'fleet',
  'hse',
];

const ENTERPRISE_MODULES: ModuleKey[] = [
  ...GROWTH_MODULES,
  'performance',
];

export const MARKETING_TIER_ENTITLEMENTS: Record<MarketingPricingTierId, MarketingTierEntitlement> = {
  starter: {
    planId: 'starter',
    maxEmployees: 25,
    includedModules: STARTER_MODULES,
    verticalEngines: false,
    multiEntity: false,
    companySetup: false,
  },
  growth: {
    planId: 'growth',
    maxEmployees: 100,
    includedModules: GROWTH_MODULES,
    verticalEngines: true,
    multiEntity: true,
    companySetup: true,
  },
  enterprise: {
    planId: 'enterprise',
    maxEmployees: null,
    includedModules: ENTERPRISE_MODULES,
    verticalEngines: true,
    multiEntity: true,
    companySetup: true,
  },
};

/** Human labels for pricing bullet copy. */
export function marketingTierModuleSummary(tierId: MarketingPricingTierId): string[] {
  const tier = MARKETING_TIER_ENTITLEMENTS[tierId];
  switch (tierId) {
    case 'starter':
      return [
        'HR & Payroll and Finance (core, leave, time, payroll, accounts)',
        `Up to ${tier.maxEmployees} employees`,
        'Employee self-service (ESS)',
        'M-Pesa disbursements',
        'KRA / NSSF / SHIF compliance',
        'Email support',
      ];
    case 'growth':
      return [
        'HR, Finance, Procurement, Legal & Admin modules',
        `Up to ${tier.maxEmployees} employees`,
        'One vertical pack (e.g. Logistics fleet)',
        'Multi-entity support',
        'Advanced approvals & workflows',
        'Priority support + onboarding',
      ];
    case 'enterprise':
      return [
        'All modules including Performance & full vertical suite',
        'Unlimited employees',
        'Dedicated success manager',
        'Custom integrations & SLAs',
        'On-site implementation',
      ];
    default:
      return [];
  }
}
