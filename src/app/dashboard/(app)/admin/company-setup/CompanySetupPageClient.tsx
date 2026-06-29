'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import type { CompanySetupSettings, ProvisioningCheckItem } from '@/lib/company-setup';
import type { PublicBrand } from '@/lib/brand';
import { CompanySetupForm } from './CompanySetupForm';
import { OperatingEntitiesSection } from './OperatingEntitiesSection';
import type { ModuleCatalogEntry } from './CompanySetupModulesSection';
import { useEntity } from '@/components/EntitySwitcher';
import type { CompanySetupCapabilities } from '@/lib/company-setup-tier-features';
import { companySetupUpgradeHint } from '@/lib/company-setup-tier-features';

type CompanySetupResponse = CompanySetupSettings & {
 defaults: CompanySetupSettings;
 resolvedBrand: PublicBrand;
 provisioning: ProvisioningCheckItem[];
 moduleCatalog: ModuleCatalogEntry[];
 capabilities: CompanySetupCapabilities;
 oauthConfigured: { microsoft: boolean; google: boolean };
 emailDomains?: import('./AuthDomainsSection').EmailDomainRow[];
 storageKey?: string;
 activeContextLabel?: string | null;
 setupAudience?: 'customer' | 'ops';
 public?: unknown;
 themePreview?: unknown;
};

export function CompanySetupPageClient() {
 const { activeEntity } = useEntity();
 const [data, setData] = useState<CompanySetupResponse | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const loadSetup = useCallback(() => {
 setLoading(true);
 setError(null);
 return fetch('/api/admin/company-setup')
 .then(async (r) => {
 const json = await r.json();
 if (!r.ok) throw new Error(json.error || 'Failed to load company setup.');
 return json as CompanySetupResponse;
 })
 .then((payload) => {
 setData(payload);
 })
 .catch((e: unknown) => {
 setError(e instanceof Error ? e.message : 'Failed to load company setup.');
 })
 .finally(() => {
 setLoading(false);
 });
 }, []);

 useEffect(() => {
 void loadSetup();
 }, [loadSetup, activeEntity.id]);

 const readyCount = data?.provisioning.filter((p) => p.ok).length ?? 0;
 const totalChecks = data?.provisioning.length ?? 0;
 const allReady = totalChecks > 0 && readyCount === totalChecks;
 const isCustomerView = data?.setupAudience !== 'ops';

 return (
 <>
 {data?.activeContextLabel ? (
 <p className="dash-setup-notice dash-setup-notice--info max-w-2xl">
 Editing branding for <strong>{data.activeContextLabel}</strong> — matches the company selected in the
 top-bar switcher ({activeEntity.name}). Switch context there first if you meant to edit a different demo.
 </p>
 ) : null}

 <aside className="dash-setup-banner">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm dash-setup-muted">
 <span className="inline-flex items-center gap-1.5">
 Payroll &amp; MFA →{' '}
 <Link href="/dashboard/settings" className="dash-setup-link">
 Settings
 </Link>
 </span>
 {isCustomerView ? (
  <span>
   Invoices &amp; bank details →{' '}
   <Link href="/dashboard/accounts/invoicing-setup" className="dash-setup-link">
    Invoicing setup
   </Link>
  </span>
 ) : (
  <>
   <span className="hidden sm:inline dash-setup-subtle" aria-hidden>
    |
   </span>
   <span>OAuth, SMTP &amp; site URL → environment variables</span>
  </>
 )}
 </div>
 {!loading && data ? (
 <div
 className={`dash-setup-status-pill ${allReady ? 'dash-setup-status-pill--ok' : 'dash-setup-status-pill--pending'}`}
 >
 <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
 {readyCount}/{totalChecks} {isCustomerView ? 'complete' : 'deployment checks'}
 </div>
 ) : null}
 </div>
 </aside>

 {error ? (
 <p className="dash-setup-alert dash-setup-alert--error">{error}</p>
 ) : null}

 {loading ? (
 <div className="flex items-center justify-center py-24">
 <Loader2 className="h-8 w-8 animate-spin dash-setup-heading-icon" />
 </div>
 ) : data ? (
 <div className="space-y-8">
 <div className="flex flex-wrap gap-2">
 <Link
 href="/dashboard/login"
 target="_blank"
 className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium dash-setup-body shadow-sm transition-colors hover:bg-[var(--dash-hover)]"
 >
 Staff login
 <ExternalLink className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden />
 </Link>
 <Link
 href="/ess/login"
 target="_blank"
 className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium dash-setup-body shadow-sm transition-colors hover:bg-[var(--dash-hover)]"
 >
 ESS login
 <ExternalLink className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden />
 </Link>
 <Link
 href="/careers"
 target="_blank"
 className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium dash-setup-body shadow-sm transition-colors hover:bg-[var(--dash-hover)]"
 >
 Careers page
 <ExternalLink className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden />
 </Link>
 </div>

 <CompanySetupForm
 initialForm={(() => {
 const {
 defaults: _d,
 resolvedBrand: _r,
 provisioning: _p,
 moduleCatalog: _mc,
 capabilities: _c,
 oauthConfigured: _o,
 public: _pub,
 themePreview: _t,
 ...form
 } = data;
 return form as CompanySetupSettings;
 })()}
 defaults={data.defaults}
 resolvedBrand={data.resolvedBrand}
 provisioning={data.provisioning}
 moduleCatalog={data.moduleCatalog}
 capabilities={data.capabilities}
 oauthConfigured={data.oauthConfigured}
 emailDomains={data.emailDomains ?? []}
 setupAudience={data.setupAudience ?? 'customer'}
 />
 {data.capabilities.canConfigureMultiEntity ? (
  <OperatingEntitiesSection />
 ) : (
  <aside className="dash-setup-notice">
   {companySetupUpgradeHint(data.capabilities.tier, 'canConfigureMultiEntity')}
  </aside>
 )}
 </div>
 ) : null}
 </>
 );
}
