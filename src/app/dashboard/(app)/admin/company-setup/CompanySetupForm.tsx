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
import type { CompanySetupSettings, ProvisioningCheckItem } from '@/lib/company-setup';
import type { PublicBrand } from '@/lib/brand';
import { LANDING_PATH_OPTIONS } from '@/lib/company-setup-constants';
import { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import { buildBrandThemeCssVars } from '@/lib/brand-theme';
import { CompanySetupModulesSection } from './CompanySetupModulesSection';
import { writeModuleAdminFlagsCookie } from '@/lib/module-cookie';

type Props = {
 initialForm: CompanySetupSettings;
 defaults: CompanySetupSettings;
 resolvedBrand: PublicBrand;
 provisioning: ProvisioningCheckItem[];
 moduleCatalog: import('./CompanySetupModulesSection').ModuleCatalogEntry[];
};

function ToggleRow({
 label,
 description,
 checked,
 onChange,
}: {
 label: string;
 description: string;
 checked: boolean;
 onChange: (value: boolean) => void;
}) {
 return (
 <label className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3 cursor-pointer hover:bg-neutral-50">
 <span>
 <span className="block text-sm font-medium text-neutral-800">{label}</span>
 <span className="block text-xs text-neutral-500 mt-0.5">{description}</span>
 </span>
 <input
 type="checkbox"
 checked={checked}
 onChange={(e) => onChange(e.target.checked)}
 className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 />
 </label>
 );
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
 <h2 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
 {Icon ? <Icon className="w-5 h-5 text-primary-600" /> : null}
 {title}
 </h2>
 {description ? <p className="text-sm text-neutral-600 mt-1">{description}</p> : null}
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
 <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
 {children}
 {hint ? <p className="text-xs text-neutral-500 mt-1">{hint}</p> : null}
 </div>
 );
}

const inputClass =
 'w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function CompanySetupForm({ initialForm, defaults, resolvedBrand, provisioning, moduleCatalog }: Props) {
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
 <p className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-100">{error}</p>
 )}
 {success && (
 <p className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-100">
 {success}
 </p>
 )}

 <SectionCard
 title="Deployment readiness"
 description={`${readyCount} of ${provisioning.length} checks passing. Complete these before go-live.`}
 icon={CheckCircle2}
 >
 <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
 {provisioning.map((item) => (
 <div
 key={item.id}
 className={`rounded-lg border px-3 py-2.5 flex gap-2.5 ${
 item.ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-neutral-200 bg-neutral-50'
 }`}
 >
 {item.ok ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
 ) : (
 <Circle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
 )}
 <div className="min-w-0">
 <p className="text-sm font-medium text-neutral-800">{item.label}</p>
 <p className="text-xs text-neutral-500 mt-0.5">{item.detail}</p>
 </div>
 </div>
 ))}
 </div>
 </SectionCard>

 <CompanySetupModulesSection form={form} setForm={setForm} moduleCatalog={moduleCatalog} />

 <form onSubmit={save} className="space-y-6">
 <SectionCard title="Brand identity" description="Organisation name, logo, and colours for this workspace. Login and marketing always show Stride as the platform." icon={Building2}>
 <div className="flex flex-col lg:flex-row gap-6">
 <div className="flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-6 min-w-[200px]">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={logoPreview} alt="Logo preview" className="max-h-16 max-w-[180px] object-contain" />
 </div>
 <div className="flex-1 grid sm:grid-cols-2 gap-4">
 <Field label="Platform name" hint="Fixed — public surfaces always show Stride">
 <input value="Stride" readOnly disabled className={`${inputClass} cursor-not-allowed bg-neutral-50 text-neutral-500`} />
 </Field>
 <Field label="Organisation name">
 <input value={form.orgName} onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} />
 </Field>
 <Field label="Tagline" hint="Careers page and optional login subtitle">
 <input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className={inputClass} placeholder={resolvedBrand.tagline} />
 </Field>
 <Field label="Wordmark" hint="Letterhead / PDF fallback text (org-specific)">
 <input value={form.wordmark} onChange={(e) => setForm((f) => ({ ...f, wordmark: e.target.value }))} className={inputClass} placeholder={resolvedBrand.wordmark} />
 </Field>
 <Field label="Primary colour">
 <div className="flex gap-2">
 <input type="color" value={form.primaryColor} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.toUpperCase() }))} className="h-10 w-12 rounded border border-neutral-300 cursor-pointer" />
 <input value={form.primaryColor} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} className={`${inputClass} font-mono uppercase`} />
 </div>
 </Field>
 <Field label="Secondary colour (navy)">
 <div className="flex gap-2">
 <input type="color" value={form.secondaryColor} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value.toUpperCase() }))} className="h-10 w-12 rounded border border-neutral-300 cursor-pointer" />
 <input value={form.secondaryColor} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))} className={`${inputClass} font-mono uppercase`} />
 </div>
 </Field>
 </div>
 </div>
 <div className="flex flex-wrap gap-3">
 <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAsset(f, 'logo'); e.target.value = ''; }} />
 <button type="button" disabled={!!uploading} onClick={() => logoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60">
 {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
 Upload logo
 </button>
 <input value={form.logoSrc} onChange={(e) => setForm((f) => ({ ...f, logoSrc: e.target.value, logoPngPath: e.target.value }))} className={`${inputClass} flex-1 min-w-[200px] font-mono`} placeholder="/brand/your-logo.png" />
 </div>
 </SectionCard>

 <SectionCard title="Login experience" description="Welcome title is always “Welcome to Stride”. Configure subtitles and sign-in methods below." icon={MessageSquare}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Staff welcome title" hint="Always “Welcome to Stride” on the login page">
 <input value="Welcome to Stride" readOnly disabled className={`${inputClass} cursor-not-allowed bg-neutral-50 text-neutral-500`} />
 </Field>
 <Field label="Staff welcome subtitle"><input value={form.staffLoginWelcomeSubtitle} onChange={(e) => setForm((f) => ({ ...f, staffLoginWelcomeSubtitle: e.target.value }))} className={inputClass} placeholder={resolvedBrand.tagline} /></Field>
 <Field label="ESS welcome title" hint="Always “Welcome to Stride” on the ESS login page">
 <input value="Welcome to Stride" readOnly disabled className={`${inputClass} cursor-not-allowed bg-neutral-50 text-neutral-500`} />
 </Field>
 <Field label="ESS welcome subtitle"><input value={form.essLoginWelcomeSubtitle} onChange={(e) => setForm((f) => ({ ...f, essLoginWelcomeSubtitle: e.target.value }))} className={inputClass} /></Field>
 </div>
 </SectionCard>

 <div className="grid xl:grid-cols-2 gap-6">
 <SectionCard title="Staff sign-in" icon={Shield}>
 <ToggleRow label="Microsoft" description="Show Continue with Microsoft" checked={form.staffEnableMicrosoftLogin} onChange={(v) => setForm((f) => ({ ...f, staffEnableMicrosoftLogin: v }))} />
 <ToggleRow label="Google" description="Show Continue with Google" checked={form.staffEnableGoogleLogin} onChange={(v) => setForm((f) => ({ ...f, staffEnableGoogleLogin: v }))} />
 <ToggleRow label="Email & password" description="Allow traditional login" checked={form.staffEnableEmailLogin} onChange={(v) => setForm((f) => ({ ...f, staffEnableEmailLogin: v }))} />
 </SectionCard>
 <SectionCard title="Employee portal (ESS)" icon={Shield}>
 <Field label="Portal title"><input value={form.essPortalTitle} onChange={(e) => setForm((f) => ({ ...f, essPortalTitle: e.target.value }))} className={inputClass} /></Field>
 <ToggleRow label="Microsoft" checked={form.essEnableMicrosoftLogin} onChange={(v) => setForm((f) => ({ ...f, essEnableMicrosoftLogin: v }))} description="ESS Microsoft SSO" />
 <ToggleRow label="Google" checked={form.essEnableGoogleLogin} onChange={(v) => setForm((f) => ({ ...f, essEnableGoogleLogin: v }))} description="ESS Google SSO" />
 <ToggleRow label="Email & password" checked={form.essEnableEmailLogin} onChange={(v) => setForm((f) => ({ ...f, essEnableEmailLogin: v }))} description="ESS email login" />
 </SectionCard>
 </div>

 <SectionCard title="Contact & legal" icon={Globe}>
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
 <Field label="Support email"><input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className={inputClass} placeholder={resolvedBrand.contactEmail} /></Field>
 <Field label="Phone"><input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className={inputClass} /></Field>
 <Field label="Email sender name"><input value={form.emailFromName} onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))} className={inputClass} placeholder={`${resolvedBrand.appName} HR`} /></Field>
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
 <Field label="Employer name on job listings"><input value={form.careersEmployerName} onChange={(e) => setForm((f) => ({ ...f, careersEmployerName: e.target.value }))} className={inputClass} placeholder={resolvedBrand.orgName} /></Field>
 <Field label="Careers tagline"><input value={form.careersTagline} onChange={(e) => setForm((f) => ({ ...f, careersTagline: e.target.value }))} className={inputClass} /></Field>
 <div className="flex gap-2">
 <input ref={careersInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAsset(f, 'careers-hero'); e.target.value = ''; }} />
 <button type="button" onClick={() => careersInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
 <Upload className="w-4 h-4" /> Hero image
 </button>
 </div>
 {form.careersHeroImageUrl ? (
 <div className="aspect-[3/1] rounded-lg overflow-hidden border border-neutral-200">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={form.careersHeroImageUrl} alt="" className="w-full h-full object-cover" />
 </div>
 ) : null}
 </SectionCard>

 <SectionCard title="Dashboard & documents" icon={LayoutDashboard}>
 <Field label="Default landing page after login">
 <select value={form.defaultLandingPath} onChange={(e) => setForm((f) => ({ ...f, defaultLandingPath: e.target.value }))} className={inputClass}>
 {LANDING_PATH_OPTIONS.map((o) => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </Field>
 <ToggleRow label="Show announcement banner" checked={form.dashboardBannerEnabled} onChange={(v) => setForm((f) => ({ ...f, dashboardBannerEnabled: v }))} description="Top of dashboard for HR notices" />
 {form.dashboardBannerEnabled ? (
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
 className="table-zebra-scope overflow-hidden rounded-lg border border-neutral-200"
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
 <Field label="Document footer text" hint="Letters and PDFs"><textarea value={form.documentFooterText} onChange={(e) => setForm((f) => ({ ...f, documentFooterText: e.target.value }))} rows={2} className={inputClass} placeholder="Registered office · Company reg. no." /></Field>
 <ToggleRow label="Hide vendor branding" checked={form.hidePoweredBy} onChange={(v) => setForm((f) => ({ ...f, hidePoweredBy: v }))} description="White-label mode where applicable" />
 </SectionCard>
 </div>

 <div className="flex justify-end sticky bottom-4 z-10">
 <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-medium hover:bg-primary-700 disabled:opacity-60">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 Save company setup
 </button>
 </div>
 </form>
 </>
 );
}
