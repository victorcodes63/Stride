'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Save, Settings } from 'lucide-react';
import type { SystemSettingsPayload } from '@/types/dashboard';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ModuleOrderSettings } from '@/components/dashboard/settings/ModuleOrderSettings';
import { DashboardOverviewSettings } from '@/components/dashboard/settings/DashboardOverviewSettings';
import { AppearanceSettings } from '@/components/dashboard/settings/AppearanceSettings';
import { PlatformContentLoader } from '@/components/platform/PlatformContentLoader';

const DEFAULTS: SystemSettingsPayload = {
 companyName: 'HRIS',
 companyEmail: 'hr@example.com',
 defaultCurrency: 'KES',
 payrollCutoffDay: 25,
 leaveApprovalMode: 'single',
 requireMfaForAdmins: false,
};

export default function SettingsPage() {
 const [form, setForm] = useState<SystemSettingsPayload>(DEFAULTS);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);
 const [canAccessCompanySetup, setCanAccessCompanySetup] = useState(false);

 useEffect(() => {
 let cancelled = false;
 Promise.all([
 fetch('/api/admin/settings').then(async (r) => {
 const data = await r.json();
 if (!r.ok) throw new Error(data.error || 'Failed to load settings.');
 return data;
 }),
 fetch('/api/config/deployment').then(async (r) => (r.ok ? r.json() : null)),
 ])
 .then(([settingsData, deployment]) => {
 if (!cancelled) {
 setForm({ ...DEFAULTS, ...(settingsData as Partial<SystemSettingsPayload>) });
 setCanAccessCompanySetup(deployment?.canAccessCompanySetup === true);
 }
 })
 .catch((e: unknown) => {
 if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load settings.');
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, []);

 async function save(e: React.FormEvent) {
 e.preventDefault();
 setSaving(true);
 setError(null);
 setSuccess(null);
 try {
 const res = await fetch('/api/admin/settings', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to save settings.');
 setForm(data);
 setSuccess('Settings saved successfully.');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to save settings.');
 } finally {
 setSaving(false);
 }
 }

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Settings}
 title="Settings"
 description="Global HRIS defaults, your workspace layout, and administrative policies."
 />

 <ModuleOrderSettings />

 <DashboardOverviewSettings />

 <AppearanceSettings />

 {canAccessCompanySetup ? (
 <aside className="dashboard-surface border px-4 py-3 text-sm text-[var(--dash-text-muted)] sm:px-5">
 Login branding and SSO toggles are in{' '}
 <Link href="/dashboard/admin/company-setup" className="font-medium text-primary-700 hover:text-primary-800">
 Company setup
 </Link>
 .
 </aside>
 ) : (
 <aside className="dashboard-surface border px-4 py-3 text-sm text-[var(--dash-text-muted)] sm:px-5">
 Branding and login customisation are available on Growth and Enterprise plans. Contact Raven Tech Group to upgrade.
 </aside>
 )}

 {error && <p className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-100">{error}</p>}
 {success && <p className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-100">{success}</p>}

 <form onSubmit={save} className="dashboard-surface shadow-sm p-5 sm:p-6 space-y-5">
 {loading ? (
 <PlatformContentLoader />
 ) : (
 <>
 <div className="grid sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Organization name</label>
 <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" required />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Organization email</label>
 <input type="email" value={form.companyEmail} onChange={(e) => setForm((f) => ({ ...f, companyEmail: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" required />
 </div>
 </div>

 <div className="grid sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Default currency</label>
 <input value={form.defaultCurrency} onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value.toUpperCase() }))} maxLength={3} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm uppercase" required />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Payroll cutoff day</label>
 <input type="number" min={1} max={31} value={form.payrollCutoffDay} onChange={(e) => setForm((f) => ({ ...f, payrollCutoffDay: Number(e.target.value) }))} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" required />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Leave approval mode</label>
 <select value={form.leaveApprovalMode} onChange={(e) => setForm((f) => ({ ...f, leaveApprovalMode: e.target.value as 'single' | 'multi' }))} className="w-full sm:w-80 px-3 py-2 border border-neutral-300 rounded-lg text-sm">
 <option value="single">Single approver</option>
 <option value="multi">Multi-step approval</option>
 </select>
 </div>

 <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
 <input type="checkbox" checked={form.requireMfaForAdmins} onChange={(e) => setForm((f) => ({ ...f, requireMfaForAdmins: e.target.checked }))} />
 Require MFA for admin users
 </label>

 <div>
 <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 Save settings
 </button>
 </div>
 </>
 )}
 </form>
 </DashboardPage>
 );
}
