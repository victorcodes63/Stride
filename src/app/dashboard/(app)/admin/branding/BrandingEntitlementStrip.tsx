'use client';

import { Lock, ShieldCheck } from 'lucide-react';
import {
  companySetupFeatureLabel,
  isCompanySetupAddOn,
  type CompanySetupCapabilities,
  type CompanySetupCapabilityFeature,
} from '@/lib/company-setup-tier-features';
import { companySetupTierLabel } from '@/lib/deployment-tier';
import { EntitlementBadge } from '../_shared/company-setup-ui';

/** Branding capabilities surfaced in the boundary strip, in display order. */
const BRANDING_FEATURES: CompanySetupCapabilityFeature[] = [
  'canConfigureColorScheme',
  'canConfigureWhiteLabel',
  'canConfigureCustomDomain',
  'canConfigureDashboardBanner',
  'canConfigureCareersPortal',
  'canConfigureMultiEntity',
];

/**
 * Read-only summary of what the plan (tier + add-ons) unlocks. This is the explicit boundary:
 * the tenant configures within it but never edits it — the control plane is the sole authority.
 */
export function BrandingEntitlementStrip({
  capabilities,
  supportUrl,
}: {
  capabilities: CompanySetupCapabilities;
  supportUrl: string;
}) {
  return (
    <section className="dash-brand-boundary space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold dash-setup-heading">
            Plan: {companySetupTierLabel(capabilities.tier)}
          </h2>
          <p className="text-xs dash-setup-muted mt-0.5">
            What your subscription unlocks for branding. Configure the unlocked items below.
          </p>
        </div>
        <span className="dash-brand-boundary-managed">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Managed by Raven Tech Group
        </span>
      </div>

      <div className="dash-brand-entitlement-grid">
        {BRANDING_FEATURES.map((feature) => {
          const enabled = Boolean(capabilities[feature]);
          const variant = !enabled ? 'locked' : isCompanySetupAddOn(capabilities, feature) ? 'addon' : 'included';
          return (
            <div key={feature} className="dash-brand-entitlement-row">
              <span className="inline-flex items-center gap-1.5 dash-setup-body">
                {!enabled ? <Lock className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden /> : null}
                {companySetupFeatureLabel(feature)}
              </span>
              <EntitlementBadge variant={variant} />
            </div>
          );
        })}
      </div>

      <p className="text-xs dash-setup-muted">
        Need something unlocked?{' '}
        <a
          href={supportUrl || 'mailto:support@getstride.co.ke'}
          target={supportUrl ? '_blank' : undefined}
          rel="noreferrer"
          className="dash-setup-link font-medium"
        >
          Contact Raven Tech Group
        </a>{' '}
        to add it to your plan.
      </p>
    </section>
  );
}
