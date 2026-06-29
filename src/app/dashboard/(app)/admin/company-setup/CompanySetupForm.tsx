'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
 Building2,
 CheckCircle2,
 Circle,
 Globe,
 LayoutDashboard,
 Loader2,
 MessageSquare,
 Save,
 Shield,
 Upload,
} from 'lucide-react';
import type { CompanySetupSettings, ProvisioningCheckItem, PortalAuthMethod } from '@/lib/company-setup';
import type { PublicBrand } from '@/lib/brand';
import { LANDING_PATH_OPTIONS } from '@/lib/company-setup-constants';
import { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import { buildBrandThemeCssVars } from '@/lib/brand-theme';
import { CompanySetupModulesSection } from './CompanySetupModulesSection';
import { writeModuleAdminFlagsCookie } from '@/lib/module-cookie';
import {
  companySetupUpgradeHint,
  type CompanySetupCapabilities,
} from '@/lib/company-setup-tier-features';
import { applyAuthMethodToSetup } from '@/lib/company-setup-auth';
import { AuthDomainsSection, type EmailDomainRow } from './AuthDomainsSection';
import { SensitiveReauthSection } from './SensitiveReauthSection';

type Props = {
 initialForm: CompanySetupSettings;
 defaults: CompanySetupSettings;
 resolvedBrand: PublicBrand;
 provisioning: ProvisioningCheckItem[];
 moduleCatalog: import('./CompanySetupModulesSection').ModuleCatalogEntry[];
 capabilities: CompanySetupCapabilities;
 oauthConfigured: { microsoft: boolean; google: boolean };
 emailDomains: EmailDomainRow[];
 setupAudience?: 'customer' | 'ops';
};

function ToggleRow({
 label,
 description,
 checked,
 onChange,
 disabled = false,
}: {
 label: string;
 description: string;
 checked: boolean;
 onChange: (value: boolean) => void;
 disabled?: boolean;
}) {
 return (
 <label className={`dash-setup-toggle-row ${disabled ? 'dash-setup-toggle-row--disabled' : ''}`}>
 <span>
 <span className="block text-sm font-medium dash-setup-label">{label}</span>
 <span className="block text-xs dash-setup-muted mt-0.5">{description}</span>
 </span>
 <input
 type="checkbox"
 checked={checked}
 disabled={disabled}
 onChange={(e) => onChange(e.target.checked)}
 className="dash-setup-control mt-1 h-4 w-4 rounded border-[var(--dash-border)]"
 />
 </label>
 );
}

function AuthMethodSelector({
 label,
 value,
 onChange,
 oauthConfigured,
 capabilities,
 isCustomerView = false,
}: {
 label: string;
 value: PortalAuthMethod;
 onChange: (method: PortalAuthMethod) => void;
 oauthConfigured: { microsoft: boolean; google: boolean };
 capabilities: CompanySetupCapabilities;
 isCustomerView?: boolean;
}) {
 const options: { id: PortalAuthMethod; title: string; description: string; configured: boolean }[] = [
  {
   id: 'microsoft',
   title: 'Microsoft',
   description: 'Work or school accounts via Azure AD / Entra ID',
   configured: oauthConfigured.microsoft,
  },
  {
   id: 'google',
   title: 'Google',
   description: 'Google Workspace accounts',
   configured: oauthConfigured.google,
  },
  {
   id: 'credentials',
   title: 'Email & password',
   description: 'Traditional login with Stride staff credentials',
   configured: true,
  },
 ];

 return (
  <fieldset className="space-y-2">
   <legend className="text-sm font-medium dash-setup-label mb-2">{label}</legend>
   <p className="text-xs dash-setup-muted mb-3">
    Choose one sign-in method. Most organisations use either Microsoft or Google — not both.
   </p>
   {options.map((option) => {
    const allowed = capabilities.allowedAuthMethods.includes(option.id);
    const disabled = !allowed;
    const needsEnv = option.id !== 'credentials' && !option.configured;
    const selected = value === option.id;
    return (
     <label
      key={option.id}
      className={`dash-setup-option ${selected ? 'dash-setup-option--selected' : ''} ${disabled ? 'dash-setup-option--disabled' : ''}`}
     >
      <input
       type="radio"
       name={label}
       value={option.id}
       checked={selected}
       disabled={disabled}
       onChange={() => onChange(option.id)}
       className="dash-setup-control mt-0.5 h-4 w-4"
      />
      <span className="min-w-0">
       <span className="block text-sm font-medium dash-setup-label">{option.title}</span>
       <span className="block text-xs dash-setup-muted mt-0.5">{option.description}</span>
       {needsEnv && selected ? (
        <span className="mt-1 block dash-setup-warn-inline">
         {isCustomerView
          ? 'Selected — contact Raven Tech Group to enable this sign-in method on your workspace.'
          : `Selected — add ${option.id === 'microsoft' ? 'MS_*' : 'GOOGLE_*'} env vars in Vercel to go live.`}
        </span>
       ) : null}
       {!allowed ? (
        <span className="mt-1 block text-xs dash-setup-muted">{companySetupUpgradeHint(capabilities.tier, 'canConfigureAuthPolicy')}</span>
       ) : null}
      </span>
     </label>
    );
   })}
  </fieldset>
 );
}

function TierLockedNotice({ message }: { message: string }) {
 return <p className="dash-setup-notice">{message}</p>;
}

function SectionCard({
 title,
 description,
 icon: Icon,
 children,
}: {
 title: string;
 description?: string;
 icon?: React.ComponentType<{ className?: string }>;
 children: React.ReactNode;
}) {
 return (
 <section className="dashboard-surface shadow-sm p-5 sm:p-6 space-y-5">
 <div>
 <h2 className="text-lg font-semibold dash-setup-heading flex items-center gap-2">
 {Icon ? <Icon className="w-5 h-5 dash-setup-heading-icon" /> : null}
 {title}
 </h2>
 {description ? <p className="text-sm dash-setup-muted mt-1">{description}</p> : null}
 </div>
 {children}
 </section>
 );
}

function Field({
 label,
 hint,
 children,
}: {
 label: string;
 hint?: string;
 children: React.ReactNode;
}) {
 return (
 <div>
 <label className="block text-sm font-medium dash-setup-label mb-1">{label}</label>
 {children}
 {hint ? <p className="text-xs dash-setup-muted mt-1">{hint}</p> : null}
 </div>
 );
}

const inputClass = 'dash-setup-input';

export function CompanySetupForm({
 initialForm,
 defaults,
 resolvedBrand,
 provisioning,
 moduleCatalog,
 capabilities,
 oauthConfigured,
 emailDomains,
 setupAudience = 'customer',
}: Props) {
 const isCustomerView = setupAudience === 'customer';
 const router = useRouter();
 const logoInputRef = useRef<HTMLInputElement>(null);
 const careersInputRef = useRef<HTMLInputElement>(null);
 const [form, setForm] = useState(initialForm);
 const [saving, setSaving] = useState(false);
 const [uploading, setUploading] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 const readyCount = provisioning.filter((p) => p.ok).length;

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
 setSuccess('Image uploaded. Save company setup to apply everywhere.');
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
 const res = await fetch('/api/admin/company-setup', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to save.');
 setForm(data);
 if (data.moduleAdminFlags) {
 writeModuleAdminFlagsCookie(data.moduleAdminFlags);
 window.dispatchEvent(new Event('hris:modules-updated'));
 }
 router.refresh();
 setSuccess('Company setup saved. Branding updates across the app after this refresh.');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to save.');
 } finally {
 setSaving(false);
 }
 }

 const logoPreview = form.logoSrc || resolvedBrand.tenantLogoSrc || DEFAULT_BRAND_LOGO_SRC;

 return (
 <>
 {error && (
 <p className="dash-setup-alert dash-setup-alert--error">{error}</p>
 )}
 {success && (
 <p className="dash-setup-alert dash-setup-alert--success">{success}</p>
 )}

 <SectionCard
 title={isCustomerView ? 'Workspace checklist' : 'Deployment readiness'}
 description={
  isCustomerView
   ? `${readyCount} of ${provisioning.length} items complete. Finish these so payslips, invoices, and portals show your company correctly.`
   : `${readyCount} of ${provisioning.length} checks passing. Complete these before go-live.`
 }
 icon={CheckCircle2}
 >
 <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
 {provisioning.map((item) => (
 <div
 key={item.id}
 className={`dash-setup-check ${item.ok ? 'dash-setup-check--ok' : ''}`}
 >
 {item.ok ? (
 <CheckCircle2 className="w-4 h-4 dash-setup-check-icon-ok shrink-0 mt-0.5" />
 ) : (
 <Circle className="w-4 h-4 dash-setup-check-icon-pending shrink-0 mt-0.5" />
 )}
 <div className="min-w-0">
 <p className="text-sm font-medium dash-setup-label">{item.label}</p>
 <p className="text-xs dash-setup-muted mt-0.5">{item.detail}</p>
 </div>
 </div>
 ))}
 </div>
 </SectionCard>

 <CompanySetupModulesSection form={form} setForm={setForm} moduleCatalog={moduleCatalog} capabilities={capabilities} />

 <form onSubmit={save} className="space-y-6">
 <SectionCard title="Brand identity" description="Your company logo, name, and colours on payslips, the employee portal, and internal documents. Invoice PDF branding is configured separately under Finance → Invoicing setup." icon={Building2}>
 <div className="flex flex-col lg:flex-row gap-6">
 <div className="dash-setup-preview-well">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={logoPreview} alt="Logo preview" className="max-h-16 max-w-[180px] object-contain" />
 </div>
 <div className="flex-1 grid sm:grid-cols-2 gap-4">
 <Field label="Organisation name" hint="Shown in the sidebar and on payslips">
 <input value={form.orgName} onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} />
 </Field>
 {!isCustomerView ? (
 <Field label="Tagline" hint="Careers page and optional login subtitle">
 <input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className={inputClass} placeholder={resolvedBrand.tagline} />
 </Field>
 ) : null}
 <Field label="Primary colour" hint="Dashboard accents and payslip highlights">
 <div className="flex gap-2">
 <input type="color" value={form.primaryColor} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.toUpperCase() }))} className="h-10 w-12 rounded border border-[var(--dash-border)] cursor-pointer bg-[var(--dash-surface-muted)]" />
 <input value={form.primaryColor} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} className={`${inputClass} font-mono uppercase`} />
 </div>
 </Field>
 <Field label="Secondary colour (navy)">
 <div className="flex gap-2">
 <input type="color" value={form.secondaryColor} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value.toUpperCase() }))} className="h-10 w-12 rounded border border-[var(--dash-border)] cursor-pointer bg-[var(--dash-surface-muted)]" />
 <input value={form.secondaryColor} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))} className={`${inputClass} font-mono uppercase`} />
 </div>
 </Field>
 </div>
 </div>
 <div className="flex flex-wrap gap-3">
 <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAsset(f, 'logo'); e.target.value = ''; }} />
 <button type="button" disabled={!!uploading} onClick={() => logoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-4 py-2 text-sm font-medium dash-setup-body hover:bg-[var(--dash-hover)] disabled:opacity-60">
 {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
 Upload logo
 </button>
 <input value={form.logoSrc} onChange={(e) => setForm((f) => ({ ...f, logoSrc: e.target.value, logoPngPath: e.target.value }))} className={`${inputClass} flex-1 min-w-[200px] font-mono`} placeholder="Upload a file or paste an image URL" />
 </div>
 {isCustomerView ? (
  <p className="text-xs dash-setup-muted">
   Invoice PDFs, VAT PIN, and bank details are managed in{' '}
   <Link href="/dashboard/accounts/invoicing-setup" className="dash-setup-link font-medium">
    Finance → Invoicing setup
   </Link>
   — separate from workspace branding here.
  </p>
 ) : null}
 </SectionCard>

 <SectionCard title="Login experience" description="Welcome title is always “Welcome to Stride”. Configure subtitles and sign-in methods below." icon={MessageSquare}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Staff welcome title" hint="Always “Welcome to Stride” on the login page">
 <input value="Welcome to Stride" readOnly disabled className={`${inputClass} cursor-not-allowed`} />
 </Field>
 <Field label="Staff welcome subtitle"><input value={form.staffLoginWelcomeSubtitle} onChange={(e) => setForm((f) => ({ ...f, staffLoginWelcomeSubtitle: e.target.value }))} className={inputClass} placeholder={resolvedBrand.tagline} /></Field>
 <Field label="ESS welcome title" hint="Always “Welcome to Stride” on the ESS login page">
 <input value="Welcome to Stride" readOnly disabled className={`${inputClass} cursor-not-allowed`} />
 </Field>
 <Field label="ESS welcome subtitle"><input value={form.essLoginWelcomeSubtitle} onChange={(e) => setForm((f) => ({ ...f, essLoginWelcomeSubtitle: e.target.value }))} className={inputClass} /></Field>
 </div>
 </SectionCard>

 <div className="grid xl:grid-cols-2 gap-6">
 <SectionCard title="Staff sign-in" icon={Shield} description="Controls the dashboard login page at /dashboard/login">
 <AuthMethodSelector
 label="staff-auth"
 value={form.staffAuthMethod}
 onChange={(method) => setForm((f) => applyAuthMethodToSetup(f, 'staff', method))}
 oauthConfigured={oauthConfigured}
 capabilities={capabilities}
 isCustomerView={isCustomerView}
 />
 </SectionCard>
 <SectionCard title="Employee portal (ESS)" icon={Shield} description="Controls the ESS login page at /ess/login">
 <Field label="Portal title"><input value={form.essPortalTitle} onChange={(e) => setForm((f) => ({ ...f, essPortalTitle: e.target.value }))} className={inputClass} /></Field>
 <AuthMethodSelector
 label="ess-auth"
 value={form.essAuthMethod}
 onChange={(method) => setForm((f) => applyAuthMethodToSetup(f, 'ess', method))}
 oauthConfigured={oauthConfigured}
 capabilities={capabilities}
 isCustomerView={isCustomerView}
 />
 </SectionCard>
 </div>

 <SectionCard title="Verified email domains" icon={Shield} description="Required for SSO and domain-based sign-in">
  <AuthDomainsSection capabilities={capabilities} initialDomains={emailDomains} />
 </SectionCard>

 <SectionCard
  title="Sensitive actions"
  icon={Shield}
  description="Optional password confirmation before invoices, payroll, and other high-impact operations"
 >
  <SensitiveReauthSection form={form} setForm={setForm} />
 </SectionCard>

 <SectionCard title="Contact & legal" icon={Globe}>
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
 <Field label="Support email"><input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className={inputClass} placeholder={resolvedBrand.contactEmail} /></Field>
 <Field label="Phone"><input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className={inputClass} /></Field>
 <Field label="Email sender name"><input value={form.emailFromName} onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.appName} /></Field>
 <Field label="Public site footer text" hint="Shown on careers and marketing pages">
 <textarea value={form.publicFooterText} onChange={(e) => setForm((f) => ({ ...f, publicFooterText: e.target.value }))} rows={3} className={inputClass} placeholder="A short about blurb for your organisation." />
 </Field>
 <Field label="Address" hint="Contact block and payslips"><input value={form.contactAddress} onChange={(e) => setForm((f) => ({ ...f, contactAddress: e.target.value }))} className={inputClass} /></Field>
 <Field label="Privacy policy URL"><input value={form.privacyPolicyUrl} onChange={(e) => setForm((f) => ({ ...f, privacyPolicyUrl: e.target.value }))} className={inputClass} /></Field>
 <Field label="Terms URL"><input value={form.termsUrl} onChange={(e) => setForm((f) => ({ ...f, termsUrl: e.target.value }))} className={inputClass} /></Field>
 <Field label="Help / support URL"><input value={form.supportUrl} onChange={(e) => setForm((f) => ({ ...f, supportUrl: e.target.value }))} className={inputClass} placeholder="https://..." /></Field>
 </div>
 </SectionCard>

 <div className="grid xl:grid-cols-2 gap-6">
 <SectionCard title="Careers portal" icon={Globe}>
 {!capabilities.canConfigureCareersPortal ? (
  <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureCareersPortal')} />
 ) : (
  <>
 <Field label="Employer name on job listings"><input value={form.careersEmployerName} onChange={(e) => setForm((f) => ({ ...f, careersEmployerName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} /></Field>
 <Field label="Careers tagline"><input value={form.careersTagline} onChange={(e) => setForm((f) => ({ ...f, careersTagline: e.target.value }))} className={inputClass} /></Field>
 <div className="flex gap-2">
 <input ref={careersInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAsset(f, 'careers-hero'); e.target.value = ''; }} />
 <button type="button" onClick={() => careersInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-4 py-2 text-sm font-medium dash-setup-body hover:bg-[var(--dash-hover)]">
 <Upload className="w-4 h-4" /> Hero image
 </button>
 </div>
 {form.careersHeroImageUrl ? (
 <div className="aspect-[3/1] rounded-lg overflow-hidden border border-[var(--dash-border)]">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={form.careersHeroImageUrl} alt="" className="w-full h-full object-cover" />
 </div>
 ) : null}
  </>
 )}
 </SectionCard>

 <SectionCard title="Dashboard & documents" icon={LayoutDashboard}>
 <Field label="Default landing page after login">
 <select value={form.defaultLandingPath} onChange={(e) => setForm((f) => ({ ...f, defaultLandingPath: e.target.value }))} className={inputClass}>
 {LANDING_PATH_OPTIONS.map((o) => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </Field>
 <ToggleRow label="Show announcement banner" checked={form.dashboardBannerEnabled} onChange={(v) => setForm((f) => ({ ...f, dashboardBannerEnabled: v }))} description="Top of dashboard for HR notices" disabled={!capabilities.canConfigureDashboardBanner} />
 {!capabilities.canConfigureDashboardBanner ? (
  <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureDashboardBanner')} />
 ) : null}
 {form.dashboardBannerEnabled && capabilities.canConfigureDashboardBanner ? (
 <>
 <Field label="Banner message"><textarea value={form.dashboardBannerText} onChange={(e) => setForm((f) => ({ ...f, dashboardBannerText: e.target.value }))} rows={2} className={inputClass} /></Field>
 <Field label="Banner tone">
 <select value={form.dashboardBannerTone} onChange={(e) => setForm((f) => ({ ...f, dashboardBannerTone: e.target.value as CompanySetupSettings['dashboardBannerTone'] }))} className={inputClass}>
 <option value="info">Info</option>
 <option value="warning">Warning</option>
 <option value="success">Success</option>
 </select>
 </Field>
 </>
 ) : null}
 <ToggleRow
 label="Table zebra striping"
 checked={form.dashboardTableZebraStriping}
 onChange={(v) => setForm((f) => ({ ...f, dashboardTableZebraStriping: v }))}
 description="Alternating row colours on dashboard lists and tables using your primary and secondary brand colours"
 />
 <div
 className="table-zebra-scope overflow-hidden rounded-lg border border-[var(--dash-border)]"
 data-table-zebra={form.dashboardTableZebraStriping ? 'true' : 'false'}
 style={buildBrandThemeCssVars(form.primaryColor, form.secondaryColor) as React.CSSProperties}
 >
 <table className="data-table dashboard-data-table w-full">
 <thead>
 <tr>
 <th>Preview</th>
 <th>Primary stripe</th>
 <th>Secondary stripe</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td className="col-primary">Row 1</td>
 <td>Neutral</td>
 <td>—</td>
 </tr>
 <tr>
 <td className="col-primary">Row 2</td>
 <td>Primary tint</td>
 <td>—</td>
 </tr>
 <tr>
 <td className="col-primary">Row 3</td>
 <td>Neutral</td>
 <td>—</td>
 </tr>
 <tr>
 <td className="col-primary">Row 4</td>
 <td>—</td>
 <td>Secondary tint</td>
 </tr>
 </tbody>
 </table>
 </div>
 <Field label="Payslip legal entity name"><input value={form.payslipLegalName} onChange={(e) => setForm((f) => ({ ...f, payslipLegalName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} /></Field>
 <Field label="Document footer text" hint="Payslips, letters, and invoice PDFs"><textarea value={form.documentFooterText} onChange={(e) => setForm((f) => ({ ...f, documentFooterText: e.target.value }))} rows={2} className={inputClass} placeholder="Registered office · Company reg. no." /></Field>
 {isCustomerView ? (
  <p className="text-sm dash-setup-muted">
   Invoice-specific options (VAT PIN, embedded logo vs letterhead) live in{' '}
   <Link href="/dashboard/accounts/invoicing-setup" className="dash-setup-link font-medium">
    Invoicing setup
   </Link>
   .
  </p>
 ) : null}
 <ToggleRow label="Hide vendor branding" checked={form.hidePoweredBy} onChange={(v) => setForm((f) => ({ ...f, hidePoweredBy: v }))} description="White-label mode where applicable" disabled={!capabilities.canConfigureWhiteLabel} />
 {!capabilities.canConfigureWhiteLabel ? (
  <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureWhiteLabel')} />
 ) : null}
 </SectionCard>
 </div>

 <div className="flex justify-end sticky bottom-4 z-10">
 <button type="submit" disabled={saving} className="btn-primary dash-panel-cta inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 Save company setup
 </button>
 </div>
 </form>
 </>
 );
}
