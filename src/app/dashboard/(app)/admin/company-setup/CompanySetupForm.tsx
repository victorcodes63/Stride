'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Loader2, Palette, Save, Shield } from 'lucide-react';
import type { CompanySetupSettings, ProvisioningCheckItem, PortalAuthMethod } from '@/lib/company-setup';
import type { PublicBrand } from '@/lib/brand';
import { CompanySetupModulesSection } from './CompanySetupModulesSection';
import { writeModuleAdminFlagsCookie } from '@/lib/module-cookie';
import {
  companySetupUpgradeHint,
  type CompanySetupCapabilities,
} from '@/lib/company-setup-tier-features';
import { applyAuthMethodToSetup } from '@/lib/company-setup-auth';
import { AuthDomainsSection, type EmailDomainRow } from './AuthDomainsSection';
import { SensitiveReauthSection } from './SensitiveReauthSection';
import {
  Field,
  SectionCard,
  ToggleRow,
  inputClass,
} from '../_shared/company-setup-ui';

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

export function CompanySetupForm({
  initialForm,
  provisioning,
  moduleCatalog,
  capabilities,
  oauthConfigured,
  emailDomains,
  setupAudience = 'customer',
}: Props) {
  const isCustomerView = setupAudience === 'customer';
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const readyCount = provisioning.filter((p) => p.ok).length;

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
      setSuccess('Company setup saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && <p className="dash-setup-alert dash-setup-alert--error">{error}</p>}
      {success && <p className="dash-setup-alert dash-setup-alert--success">{success}</p>}

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

      <aside className="dash-setup-notice dash-setup-notice--info flex flex-wrap items-center gap-2">
        <Palette className="h-4 w-4 dash-setup-heading-icon" aria-hidden />
        <span>
          Logo, colours, and white-label options now live in{' '}
          <Link href="/dashboard/admin/branding" className="dash-setup-link font-medium">
            Branding &amp; white-label
          </Link>
          .
        </span>
      </aside>

      <CompanySetupModulesSection form={form} setForm={setForm} moduleCatalog={moduleCatalog} capabilities={capabilities} />

      <form onSubmit={save} className="space-y-6">
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

        {capabilities.canConfigureSaml ? (
          <SectionCard
            title="Enterprise SAML (AUTH-09)"
            icon={Shield}
            description="Store IdP metadata URL for Raven ops activation. SAML sign-in returns 501 until activated."
          >
            <Field label="IdP metadata URL">
              <input
                value={form.samlIdpMetadataUrl}
                onChange={(e) => setForm((f) => ({ ...f, samlIdpMetadataUrl: e.target.value }))}
                className={inputClass}
                placeholder="https://idp.example.com/metadata.xml"
              />
            </Field>
            <div className="mt-4 space-y-2">
              <ToggleRow
                label="Enable SAML for staff"
                description="When activated, staff can use SAML 2.0 instead of OAuth/password."
                checked={form.samlEnabledStaff}
                onChange={(value) => setForm((f) => ({ ...f, samlEnabledStaff: value }))}
              />
              <ToggleRow
                label="Enable SAML for ESS"
                description="When activated, employees can use SAML 2.0 on the ESS portal."
                checked={form.samlEnabledEss}
                onChange={(value) => setForm((f) => ({ ...f, samlEnabledEss: value }))}
              />
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Sensitive actions"
          icon={Shield}
          description="Optional password confirmation before invoices, payroll, and other high-impact operations"
        >
          <SensitiveReauthSection form={form} setForm={setForm} />
        </SectionCard>

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
