'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { CompanySetupSettings } from '@/lib/company-setup';
import type { PublicBrand } from '@/lib/brand';
import type { CompanySetupCapabilities } from '@/lib/company-setup-tier-features';
import { useEntity } from '@/components/EntitySwitcher';
import { BrandingEntitlementStrip } from './BrandingEntitlementStrip';
import { BrandingWhiteLabelForm } from './BrandingWhiteLabelForm';

type BrandingResponse = CompanySetupSettings & {
  resolvedBrand: PublicBrand;
  capabilities: CompanySetupCapabilities;
  activeContextLabel?: string | null;
};

export function BrandingPageClient() {
  const { activeEntity } = useEntity();
  const [data, setData] = useState<BrandingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch('/api/admin/company-setup')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load branding.');
        return json as BrandingResponse;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load branding.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeEntity.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin dash-setup-heading-icon" />
      </div>
    );
  }

  if (error) {
    return <p className="dash-setup-alert dash-setup-alert--error">{error}</p>;
  }

  if (!data) return null;

  const { resolvedBrand, capabilities, activeContextLabel, ...form } = data;

  return (
    <div className="space-y-6">
      {activeContextLabel ? (
        <p className="dash-setup-notice dash-setup-notice--info max-w-2xl">
          Editing branding for <strong>{activeContextLabel}</strong> — matches the company selected in
          the top-bar switcher ({activeEntity.name}).
        </p>
      ) : null}

      <BrandingEntitlementStrip capabilities={capabilities} supportUrl={resolvedBrand.supportUrl} />

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/login" target="_blank" className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium dash-setup-body shadow-sm transition-colors hover:bg-[var(--dash-hover)]">
          Staff login <ExternalLink className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden />
        </Link>
        <Link href="/ess/login" target="_blank" className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium dash-setup-body shadow-sm transition-colors hover:bg-[var(--dash-hover)]">
          ESS login <ExternalLink className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden />
        </Link>
        <Link href="/careers" target="_blank" className="inline-flex items-center gap-1.5 dashboard-surface rounded-lg px-3 py-2 text-xs font-medium dash-setup-body shadow-sm transition-colors hover:bg-[var(--dash-hover)]">
          Careers page <ExternalLink className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden />
        </Link>
      </div>

      <BrandingWhiteLabelForm
        initialForm={form as CompanySetupSettings}
        resolvedBrand={resolvedBrand}
        capabilities={capabilities}
      />
    </div>
  );
}
