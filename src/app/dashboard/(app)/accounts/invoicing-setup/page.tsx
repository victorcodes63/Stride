'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileSignature,
  Loader2,
  Upload,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import { isValidHexColor } from '@/lib/brand-theme';
import type { InvoiceLetterheadMode, InvoiceSetupSettings, InvoiceSetupSnapshot } from '@/lib/invoice-setup';
import { DEFAULT_INVOICE_PANEL_BACKGROUND } from '@/lib/invoice-setup';

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

function settingsFromSnapshot(data: InvoiceSetupSnapshot): InvoiceSetupSettings {
  return data.settings;
}

function InvoicingSetupPageInner() {
  const [snapshot, setSnapshot] = useState<InvoiceSetupSnapshot | null>(null);
  const [form, setForm] = useState<InvoiceSetupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/accounts/invoice-setup')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
        return data as InvoiceSetupSnapshot;
      })
      .then((data) => {
        setSnapshot(data);
        setForm(settingsFromSnapshot(data));
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setSnapshot(null);
        setForm(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const readyCount = useMemo(
    () => snapshot?.checklist.filter((c) => c.ok).length ?? 0,
    [snapshot],
  );
  const totalCount = snapshot?.checklist.length ?? 0;
  const allReady = totalCount > 0 && readyCount === totalCount;

  const saveSettings = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/accounts/invoice-setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const next = data as InvoiceSetupSnapshot;
      setSnapshot(next);
      setForm(settingsFromSnapshot(next));
      setMessage('Invoicing setup saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/accounts/invoice-setup/upload', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((f) => (f ? { ...f, logoSrc: data.logoSrc ?? f.logoSrc } : f));
      setMessage('Logo uploaded. Save to confirm other changes.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const scrollToAnchor = (anchor?: string) => {
    if (!anchor) return;
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const logoPreview = form?.logoSrc || snapshot?.branding.logoUrl || DEFAULT_BRAND_LOGO_SRC;
  const accentFallback = snapshot?.branding.primaryColor ?? '#000000';
  const accentPickerValue = (isValidHexColor(form?.primaryColor ?? '')
    ? form!.primaryColor
    : accentFallback
  ).toLowerCase();

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={FileSignature}
        title="Invoicing setup"
        description="Everything you need for client invoices and credit notes — company identity, PDF layout, and payment details. Independent of Admin → Company setup."
        actions={
          <a
            href="/api/accounts/invoice-setup/sample-pdf?disposition=inline"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            Preview sample PDF
          </a>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {message && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading invoicing setup…
        </div>
      ) : snapshot && form ? (
        <div className="space-y-6">
          <section className="dashboard-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Readiness checklist</h2>
                <p className="text-sm text-neutral-600 mt-1">
                  {allReady
                    ? 'Your invoicing setup is complete — invoices will use your branding.'
                    : `${readyCount} of ${totalCount} items complete.`}
                </p>
              </div>
              {allReady ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready to invoice
                </span>
              ) : null}
            </div>
            <ul className="divide-y divide-neutral-100">
              {snapshot.checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  {item.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-neutral-300 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                    <p className="text-sm text-neutral-600 truncate">{item.detail}</p>
                  </div>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-primary-800 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      Configure
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : item.anchor ? (
                    <button
                      type="button"
                      onClick={() => scrollToAnchor(item.anchor)}
                      className="text-sm font-medium text-primary-800 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      Configure
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section id="identity" className="dashboard-surface p-5 shadow-sm scroll-mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-neutral-500" />
              <h2 className="text-sm font-semibold text-neutral-900">Company identity on invoices</h2>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              Logo, legal name, address, and colours used on invoice and credit note PDFs only.
            </p>

            <div className="flex flex-col lg:flex-row gap-6 mb-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 min-w-[140px] flex items-center justify-center">
                <img
                  src={logoPreview}
                  alt="Invoice logo"
                  className="max-h-14 max-w-[160px] object-contain"
                />
              </div>
              <div className="flex-1 space-y-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadLogo(f);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => logoInputRef.current?.click()}
                    className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload logo
                  </button>
                  <input
                    className={`${inputClass} flex-1 min-w-[200px] font-mono`}
                    value={form.logoSrc}
                    onChange={(e) => setForm((f) => (f ? { ...f, logoSrc: e.target.value } : f))}
                    placeholder="Or paste an image URL"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Legal / trading name</label>
                <input
                  className={inputClass}
                  value={form.invoiceLegalName}
                  onChange={(e) => setForm((f) => (f ? { ...f, invoiceLegalName: e.target.value } : f))}
                  placeholder={snapshot.branding.legalName || 'Your company name'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Contact email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => (f ? { ...f, contactEmail: e.target.value } : f))}
                  placeholder="billing@example.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Billing address</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={form.contactAddress}
                  onChange={(e) => setForm((f) => (f ? { ...f, contactAddress: e.target.value } : f))}
                  placeholder="Street, city, country"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Phone (optional)</label>
                <input
                  className={inputClass}
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => (f ? { ...f, contactPhone: e.target.value } : f))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">PDF accent colour</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={accentPickerValue}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, primaryColor: e.target.value.toUpperCase() } : f))
                    }
                    className="h-10 w-12 rounded border border-neutral-300 cursor-pointer"
                  />
                  <input
                    className={`${inputClass} font-mono uppercase`}
                    value={form.primaryColor}
                    onChange={(e) => setForm((f) => (f ? { ...f, primaryColor: e.target.value } : f))}
                    placeholder={accentFallback}
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5">
                  Used for headings and highlights on invoice PDFs.
                  {!isValidHexColor(form.primaryColor)
                    ? ` Leave blank to use company colour (${accentFallback}).`
                    : null}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Header background</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    { id: '', label: 'White (none)' },
                    { id: '#000000', label: 'Black' },
                    { id: '#1A1714', label: 'Ink' },
                  ].map((preset) => (
                    <button
                      key={preset.id || 'none'}
                      type="button"
                      onClick={() =>
                        setForm((f) => (f ? { ...f, headerBackgroundColor: preset.id } : f))
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        (form.headerBackgroundColor || '') === preset.id
                          ? 'border-primary-800 bg-primary-50 text-primary-900'
                          : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      isValidHexColor(form.headerBackgroundColor)
                        ? form.headerBackgroundColor.toLowerCase()
                        : '#000000'
                    }
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, headerBackgroundColor: e.target.value.toUpperCase() } : f,
                      )
                    }
                    className="h-10 w-12 rounded border border-neutral-300 cursor-pointer"
                  />
                  <input
                    className={`${inputClass} font-mono uppercase`}
                    value={form.headerBackgroundColor}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, headerBackgroundColor: e.target.value } : f))
                    }
                    placeholder="Custom hex or leave empty"
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5">
                  Optional band behind your logo and company block — ideal for logos that need a dark
                  background. Text colour switches automatically (white on dark, accent on light).
                  Use embedded logo mode below.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Document footer</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={form.documentFooterText}
                  onChange={(e) => setForm((f) => (f ? { ...f, documentFooterText: e.target.value } : f))}
                  placeholder="Registered office, company registration number, etc."
                />
              </div>
            </div>
          </section>

          <section id="pdf-options" className="dashboard-surface p-5 shadow-sm scroll-mt-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-1">Invoice PDF options</h2>
            <p className="text-sm text-neutral-600 mb-4">Letterhead mode and tax details for PDF output.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Letterhead mode</label>
                <select
                  className={inputClass}
                  value={form.letterheadMode}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, letterheadMode: e.target.value as InvoiceLetterheadMode } : f))
                  }
                >
                  <option value="preprinted">Pre-printed letterhead (blank top margin)</option>
                  <option value="embedded_logo">Embed company logo in PDF</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">VAT PIN</label>
                <input
                  className={inputClass}
                  value={form.vatPin}
                  onChange={(e) => setForm((f) => (f ? { ...f, vatPin: e.target.value } : f))}
                  placeholder="e.g. P051234567X"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">
                  Panel shading colour
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    { id: '', label: `Default (${DEFAULT_INVOICE_PANEL_BACKGROUND})` },
                    { id: '#FFFFFF', label: 'White' },
                    { id: '#E8F4FC', label: 'Light blue' },
                    { id: '#FEF3C7', label: 'Warm sand' },
                  ].map((preset) => (
                    <button
                      key={preset.id || 'default'}
                      type="button"
                      onClick={() =>
                        setForm((f) => (f ? { ...f, panelBackgroundColor: preset.id } : f))
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        (form.panelBackgroundColor || '') === preset.id
                          ? 'border-primary-800 bg-primary-50 text-primary-900'
                          : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      isValidHexColor(form.panelBackgroundColor)
                        ? form.panelBackgroundColor.toLowerCase()
                        : DEFAULT_INVOICE_PANEL_BACKGROUND.toLowerCase()
                    }
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, panelBackgroundColor: e.target.value.toUpperCase() } : f,
                      )
                    }
                    className="h-10 w-12 rounded border border-neutral-300 cursor-pointer"
                  />
                  <input
                    className={`${inputClass} font-mono uppercase`}
                    value={form.panelBackgroundColor}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, panelBackgroundColor: e.target.value } : f))
                    }
                    placeholder={DEFAULT_INVOICE_PANEL_BACKGROUND}
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5">
                  Used for the invoice-to box, table header row, and payment-details panel on PDFs.
                  Text colour adapts automatically for readability on dark or light shades.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-start">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSettings()}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save invoicing setup
            </button>
          </div>

          <section className="dashboard-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-5 w-5 text-neutral-500" />
                  <h2 className="text-sm font-semibold text-neutral-900">Payment accounts</h2>
                </div>
                <p className="text-sm text-neutral-600">
                  {snapshot.paymentAccountCount > 0
                    ? `${snapshot.paymentAccountCount} active account${snapshot.paymentAccountCount === 1 ? '' : 's'} configured for invoice PDFs.`
                    : 'Add bank accounts that appear on invoice and credit note PDFs.'}
                </p>
              </div>
              <Link href="/dashboard/accounts/payment-accounts" className="btn-secondary inline-flex items-center gap-2">
                Manage accounts
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </DashboardPage>
  );
}

export default function InvoicingSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-neutral-600 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      }
    >
      <InvoicingSetupPageInner />
    </Suspense>
  );
}
