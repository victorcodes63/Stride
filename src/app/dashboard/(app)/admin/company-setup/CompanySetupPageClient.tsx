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

type CompanySetupResponse = CompanySetupSettings & {
 defaults: CompanySetupSettings;
 resolvedBrand: PublicBrand;
 provisioning: ProvisioningCheckItem[];
 moduleCatalog: ModuleCatalogEntry[];
 storageKey?: string;
 activeContextLabel?: string | null;
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

 return (
 <>
 {data?.activeContextLabel ? (
 <p className="text-sm text-primary-800 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 max-w-2xl">
 Editing branding for <strong>{data.activeContextLabel}</strong> — matches the company selected in the
 top-bar switcher ({activeEntity.name}). Switch context there first if you meant to edit a different demo.
 </p>
 ) : null}

 <aside className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3.5 sm:px-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
 <span className="inline-flex items-center gap-1.5">
 Payroll &amp; MFA →{' '}
 <Link href="/dashboard/settings" className="font-medium text-primary-700 hover:text-primary-800">
 Settings
 </Link>
 </span>
 <span className="hidden sm:inline text-neutral-300" aria-hidden>
 |
 </span>
 <span>OAuth, SMTP &amp; site URL → environment variables</span>
 </div>
 {!loading && data ? (
 <div
 className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
 allReady
 ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
 : 'bg-amber-50 text-amber-900 ring-amber-200'
 }`}
 >
 <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
 {readyCount}/{totalChecks} deployment checks
 </div>
 ) : null}
 </div>
 </aside>

 {error ? (
 <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
 ) : null}

 {loading ? (
 <div className="flex items-center justify-center py-24">
 <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
 </div>
 ) : data ? (
 <div className="space-y-8">
 <div className="flex flex-wrap gap-2">
 <Link
 href="/dashboard/login"
 target="_blank"
 className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
 >
 Staff login
 <ExternalLink className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
 </Link>
 <Link
 href="/ess/login"
 target="_blank"
 className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
 >
 ESS login
 <ExternalLink className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
 </Link>
 <Link
 href="/careers"
 target="_blank"
 className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
 >
 Careers page
 <ExternalLink className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
 </Link>
 </div>

 <CompanySetupForm
 initialForm={(() => {
 const {
 defaults: _d,
 resolvedBrand: _r,
 provisioning: _p,
 moduleCatalog: _mc,
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
 />
 <OperatingEntitiesSection />
 </div>
 ) : null}
 </>
 );
}
