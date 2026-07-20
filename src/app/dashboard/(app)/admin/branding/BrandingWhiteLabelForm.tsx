'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Globe,
  LayoutDashboard,
  Link2,
  Loader2,
  MessageSquare,
  Palette,
  Save,
  Upload,
} from 'lucide-react';
import type { CompanySetupSettings } from '@/lib/company-setup';
import type { PublicBrand } from '@/lib/brand';
import { LANDING_PATH_OPTIONS } from '@/lib/company-setup-constants';
import { StrideSelect } from '@/components/ui/stride-select';
import { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import {
  companySetupUpgradeHint,
  isCompanySetupAddOn,
  type CompanySetupCapabilities,
  type CompanySetupCapabilityFeature,
} from '@/lib/company-setup-tier-features';
import {
  EntitlementBadge,
  Field,
  SectionCard,
  ToggleRow,
  TierLockedNotice,
  inputClass,
} from '../_shared/company-setup-ui';
import { BrandingPreview } from './BrandingPreview';

/** Fields this surface owns. PATCH sends only these so it never clobbers auth / module config. */
const BRANDING_KEYS: (keyof CompanySetupSettings)[] = [
  'appName',
  'orgName',
  'tagline',
  'wordmark',
  'logoSrc',
  'logoPngPath',
  'faviconSrc',
  'primaryColor',
  'secondaryColor',
  'staffLoginWelcomeSubtitle',
  'essLoginWelcomeSubtitle',
  'contactEmail',
  'contactPhone',
  'contactAddress',
  'emailFromName',
  'privacyPolicyUrl',
  'termsUrl',
  'supportUrl',
  'publicFooterText',
  'careersEmployerName',
  'careersTagline',
  'careersHeroImageUrl',
  'defaultLandingPath',
  'dashboardBannerEnabled',
  'dashboardBannerText',
  'dashboardBannerTone',
  'dashboardTableZebraStriping',
  'payslipLegalName',
  'documentFooterText',
  'hidePoweredBy',
  'customDomain',
];

type Props = {
  initialForm: CompanySetupSettings;
  resolvedBrand: PublicBrand;
  capabilities: CompanySetupCapabilities;
};

export function BrandingWhiteLabelForm({ initialForm, resolvedBrand, capabilities }: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const careersInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function badgeVariant(feature: CompanySetupCapabilityFeature): 'included' | 'addon' | 'locked' {
    const enabled = Boolean(capabilities[feature]);
    if (!enabled) return 'locked';
    return isCompanySetupAddOn(capabilities, feature) ? 'addon' : 'included';
  }

  async function uploadAsset(file: File, kind: string) {
    setUploading(kind);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      const res = await fetch('/api/admin/company-setup/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setForm(data);
      setSuccess('Image uploaded. Save to apply everywhere.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Partial<CompanySetupSettings> = {};
      for (const key of BRANDING_KEYS) {
        (payload as Record<string, unknown>)[key] = form[key];
      }
      const res = await fetch('/api/admin/company-setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save.');
      setForm((prev) => ({ ...prev, ...data }));
      router.refresh();
      setSuccess('Branding saved. Updates cascade across the app after this refresh.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const logoPreview = form.logoSrc || resolvedBrand.tenantLogoSrc || DEFAULT_BRAND_LOGO_SRC;

  return (
    <>
      {error && <p className="dash-setup-alert dash-setup-alert--error">{error}</p>}
      {success && <p className="dash-setup-alert dash-setup-alert--success">{success}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={save} className="space-y-6 min-w-0">
          <SectionCard
            title="Brand identity"
            description="Logo, name, and colours on payslips, the employee portal, and internal documents."
            icon={Building2}
            action={<EntitlementBadge variant={badgeVariant('canConfigureWhiteLabel')} />}
          >
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="dash-setup-preview-well">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Logo preview" className="max-h-16 max-w-[180px] object-contain" />
              </div>
              <div className="flex-1 grid sm:grid-cols-2 gap-4">
                <Field label="Organisation name" hint="Shown in the sidebar and on payslips">
                  <input value={form.orgName} onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} />
                </Field>
                <Field label="App name" hint="Replaces “Stride” on the login screen, sidebar, and browser tab">
                  <input value={form.appName} disabled={!capabilities.canConfigureWhiteLabel} onChange={(e) => setForm((f) => ({ ...f, appName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.appName} />
                </Field>
                <Field label="Wordmark" hint="Text logo shown where no image logo is set (defaults to the app name)">
                  <input value={form.wordmark} disabled={!capabilities.canConfigureWhiteLabel} onChange={(e) => setForm((f) => ({ ...f, wordmark: e.target.value }))} className={inputClass} placeholder={resolvedBrand.wordmark} />
                </Field>
              </div>
            </div>
            {!capabilities.canConfigureWhiteLabel ? (
              <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureWhiteLabel')} />
            ) : null}
            <div className="flex flex-wrap gap-3">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAsset(f, 'logo'); e.target.value = ''; }} />
              <button type="button" disabled={!!uploading} onClick={() => logoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-4 py-2 text-sm font-medium dash-setup-body hover:bg-[var(--dash-hover)] disabled:opacity-60">
                {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload logo
              </button>
              <input value={form.logoSrc} onChange={(e) => setForm((f) => ({ ...f, logoSrc: e.target.value, logoPngPath: e.target.value }))} className={`${inputClass} flex-1 min-w-[200px] font-mono`} placeholder="Upload a file or paste an image URL" />
            </div>
          </SectionCard>

          <SectionCard
            title="Colour scheme"
            description="Applied live across the dashboard, employee portal, buttons, and payslip highlights."
            icon={Palette}
            action={<EntitlementBadge variant={badgeVariant('canConfigureColorScheme')} />}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Primary colour">
                <div className="flex gap-2">
                  <input type="color" value={form.primaryColor} disabled={!capabilities.canConfigureColorScheme} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.toUpperCase() }))} className="h-10 w-12 rounded border border-[var(--dash-border)] cursor-pointer bg-[var(--dash-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50" />
                  <input value={form.primaryColor} disabled={!capabilities.canConfigureColorScheme} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} className={`${inputClass} font-mono uppercase`} />
                </div>
              </Field>
              <Field label="Secondary colour (navy)">
                <div className="flex gap-2">
                  <input type="color" value={form.secondaryColor} disabled={!capabilities.canConfigureColorScheme} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value.toUpperCase() }))} className="h-10 w-12 rounded border border-[var(--dash-border)] cursor-pointer bg-[var(--dash-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50" />
                  <input value={form.secondaryColor} disabled={!capabilities.canConfigureColorScheme} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))} className={`${inputClass} font-mono uppercase`} />
                </div>
              </Field>
            </div>
            {!capabilities.canConfigureColorScheme ? (
              <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureColorScheme')} />
            ) : null}
          </SectionCard>

          <SectionCard title="Login experience" description={`Welcome title reads “Welcome to ${resolvedBrand.appName}”. Configure the subtitles below.`} icon={MessageSquare}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Staff welcome subtitle"><input value={form.staffLoginWelcomeSubtitle} onChange={(e) => setForm((f) => ({ ...f, staffLoginWelcomeSubtitle: e.target.value }))} className={inputClass} placeholder={resolvedBrand.tagline} /></Field>
              <Field label="ESS welcome subtitle"><input value={form.essLoginWelcomeSubtitle} onChange={(e) => setForm((f) => ({ ...f, essLoginWelcomeSubtitle: e.target.value }))} className={inputClass} /></Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Custom domain"
            description="Serve your workspace from your own domain. Raven Tech Group provisions DNS and certificates after you request it."
            icon={Link2}
            action={<EntitlementBadge variant={badgeVariant('canConfigureCustomDomain')} />}
          >
            {capabilities.canConfigureCustomDomain ? (
              <>
                <Field label="Desired domain" hint="e.g. hr.yourcompany.com — leave blank to keep the default Stride domain">
                  <input value={form.customDomain} onChange={(e) => setForm((f) => ({ ...f, customDomain: e.target.value.trim() }))} className={`${inputClass} font-mono`} placeholder="hr.yourcompany.com" />
                </Field>
                {form.customDomain.trim() ? (
                  <p className="dash-setup-notice dash-setup-notice--info">
                    <strong>{form.customDomain.trim()}</strong> is queued for activation. Raven Tech Group will
                    reach out with the DNS records to add — the domain goes live once verified.
                  </p>
                ) : null}
              </>
            ) : (
              <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureCustomDomain')} />
            )}
          </SectionCard>

          <SectionCard
            title="Careers portal"
            icon={Globe}
            action={<EntitlementBadge variant={badgeVariant('canConfigureCareersPortal')} />}
          >
            {!capabilities.canConfigureCareersPortal ? (
              <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureCareersPortal')} />
            ) : (
              <div className="space-y-4">
                <Field label="Employer name on job listings"><input value={form.careersEmployerName} onChange={(e) => setForm((f) => ({ ...f, careersEmployerName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} /></Field>
                <Field label="Careers tagline"><input value={form.careersTagline} onChange={(e) => setForm((f) => ({ ...f, careersTagline: e.target.value }))} className={inputClass} /></Field>
                <div className="flex gap-2">
                  <input ref={careersInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAsset(f, 'careers-hero'); e.target.value = ''; }} />
                  <button type="button" disabled={!!uploading} onClick={() => careersInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-4 py-2 text-sm font-medium dash-setup-body hover:bg-[var(--dash-hover)] disabled:opacity-60">
                    {uploading === 'careers-hero' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Hero image
                  </button>
                </div>
                {form.careersHeroImageUrl ? (
                  <div className="aspect-[3/1] rounded-lg overflow-hidden border border-[var(--dash-border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.careersHeroImageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Dashboard & documents"
            icon={LayoutDashboard}
            action={<EntitlementBadge variant={badgeVariant('canConfigureDashboardBanner')} />}
          >
            <Field label="Default landing page after login">
              <StrideSelect
                value={form.defaultLandingPath}
                onChange={(value) => setForm((f) => ({ ...f, defaultLandingPath: value }))}
                options={LANDING_PATH_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                ariaLabel="Default landing page after login"
              />
            </Field>
            <ToggleRow label="Show announcement banner" checked={form.dashboardBannerEnabled} onChange={(v) => setForm((f) => ({ ...f, dashboardBannerEnabled: v }))} description="Top of dashboard for HR notices" disabled={!capabilities.canConfigureDashboardBanner} />
            {!capabilities.canConfigureDashboardBanner ? (
              <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureDashboardBanner')} />
            ) : null}
            {form.dashboardBannerEnabled && capabilities.canConfigureDashboardBanner ? (
              <>
                <Field label="Banner message"><textarea value={form.dashboardBannerText} onChange={(e) => setForm((f) => ({ ...f, dashboardBannerText: e.target.value }))} rows={2} className={inputClass} /></Field>
                <Field label="Banner tone">
                  <StrideSelect
                    value={form.dashboardBannerTone}
                    onChange={(value) => setForm((f) => ({ ...f, dashboardBannerTone: value as CompanySetupSettings['dashboardBannerTone'] }))}
                    options={[
                      { value: 'info', label: 'Info' },
                      { value: 'warning', label: 'Warning' },
                      { value: 'success', label: 'Success' },
                    ]}
                    ariaLabel="Banner tone"
                  />
                </Field>
              </>
            ) : null}
            <ToggleRow
              label="Table zebra striping"
              checked={form.dashboardTableZebraStriping}
              onChange={(v) => setForm((f) => ({ ...f, dashboardTableZebraStriping: v }))}
              description="Alternating row colours on dashboard lists and tables using your brand colours"
            />
            <Field label="Payslip legal entity name"><input value={form.payslipLegalName} onChange={(e) => setForm((f) => ({ ...f, payslipLegalName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} /></Field>
            <Field label="Document footer text" hint="Payslips, letters, and invoice PDFs"><textarea value={form.documentFooterText} onChange={(e) => setForm((f) => ({ ...f, documentFooterText: e.target.value }))} rows={2} className={inputClass} placeholder="Registered office · Company reg. no." /></Field>
            <ToggleRow label="Hide vendor branding" checked={form.hidePoweredBy} onChange={(v) => setForm((f) => ({ ...f, hidePoweredBy: v }))} description="White-label mode — removes “Powered by Stride” where applicable" disabled={!capabilities.canConfigureWhiteLabel} />
            {!capabilities.canConfigureWhiteLabel ? (
              <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureWhiteLabel')} />
            ) : null}
          </SectionCard>

          <SectionCard title="Contact & legal" icon={Globe}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Support email"><input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className={inputClass} placeholder={resolvedBrand.contactEmail} /></Field>
              <Field label="Phone"><input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className={inputClass} /></Field>
              <Field label="Email sender name"><input value={form.emailFromName} onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.appName} /></Field>
              <Field label="Address" hint="Contact block and payslips"><input value={form.contactAddress} onChange={(e) => setForm((f) => ({ ...f, contactAddress: e.target.value }))} className={inputClass} /></Field>
              <Field label="Privacy policy URL"><input value={form.privacyPolicyUrl} onChange={(e) => setForm((f) => ({ ...f, privacyPolicyUrl: e.target.value }))} className={inputClass} /></Field>
              <Field label="Terms URL"><input value={form.termsUrl} onChange={(e) => setForm((f) => ({ ...f, termsUrl: e.target.value }))} className={inputClass} /></Field>
              <Field label="Help / support URL"><input value={form.supportUrl} onChange={(e) => setForm((f) => ({ ...f, supportUrl: e.target.value }))} className={inputClass} placeholder="https://..." /></Field>
              <Field label="Public site footer text" hint="Shown on careers and marketing pages">
                <textarea value={form.publicFooterText} onChange={(e) => setForm((f) => ({ ...f, publicFooterText: e.target.value }))} rows={3} className={inputClass} placeholder="A short about blurb for your organisation." />
              </Field>
            </div>
            <p className="text-xs dash-setup-muted">
              Invoice PDFs, VAT PIN, and bank details are managed in{' '}
              <Link href="/dashboard/accounts/invoicing-setup" className="dash-setup-link font-medium">Finance → Invoicing setup</Link>.
            </p>
          </SectionCard>

          <div className="flex justify-end sticky bottom-4 z-10">
            <button type="submit" disabled={saving} className="btn-primary dash-panel-cta inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save branding
            </button>
          </div>
        </form>

        <div className="min-w-0">
          <BrandingPreview form={form} resolvedBrand={resolvedBrand} allowWhiteLabel={capabilities.canConfigureWhiteLabel} />
        </div>
      </div>
    </>
  );
}
