'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import type { InvoiceLetterheadMode, InvoiceSetupSnapshot } from '@/lib/invoice-setup';

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

function InvoicingSetupPageInner() {
  const [snapshot, setSnapshot] = useState<InvoiceSetupSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [letterheadMode, setLetterheadMode] = useState<InvoiceLetterheadMode>('preprinted');
  const [vatPin, setVatPin] = useState('');
  const [invoiceLegalName, setInvoiceLegalName] = useState('');

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
        setLetterheadMode(data.settings.letterheadMode);
        setVatPin(data.settings.vatPin);
        setInvoiceLegalName(data.settings.invoiceLegalName);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setSnapshot(null);
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
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/accounts/invoice-setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterheadMode, vatPin, invoiceLegalName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSnapshot(data as InvoiceSetupSnapshot);
      setMessage('Invoice settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const logoPreview = snapshot?.companyIdentity.logoSrc || DEFAULT_BRAND_LOGO_SRC;

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={FileSignature}
        title="Invoicing setup"
        description="Configure your company identity, invoice PDF layout, and payment details before sending invoices to clients."
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
      ) : snapshot ? (
        <div className="space-y-6">
          <section className="dashboard-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Readiness checklist</h2>
                <p className="text-sm text-neutral-600 mt-1">
                  {allReady
                    ? 'Your invoicing setup is complete — invoices will use your company branding.'
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
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="dashboard-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-neutral-500" />
              <h2 className="text-sm font-semibold text-neutral-900">Company identity</h2>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              Logo, organisation name, address, and document footer are managed in Company setup and
              shared across payslips, letters, and invoices.
            </p>
            <div className="flex flex-wrap gap-6 items-start">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 min-w-[140px] flex items-center justify-center">
                <img
                  src={logoPreview}
                  alt="Company logo"
                  className="max-h-14 max-w-[160px] object-contain"
                />
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm flex-1 min-w-[240px]">
                <div>
                  <dt className="text-neutral-500">Organisation</dt>
                  <dd className="font-medium text-neutral-900">{snapshot.companyIdentity.orgName || '—'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Billing address</dt>
                  <dd className="text-neutral-900">{snapshot.companyIdentity.contactAddress || '—'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Contact email</dt>
                  <dd className="text-neutral-900">{snapshot.companyIdentity.contactEmail || '—'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Document footer</dt>
                  <dd className="text-neutral-900">{snapshot.companyIdentity.documentFooterText || '—'}</dd>
                </div>
              </dl>
            </div>
            <Link
              href="/dashboard/admin/company-setup"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-800 hover:underline"
            >
              Edit in Company setup
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <section className="dashboard-surface p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900 mb-1">Invoice PDF options</h2>
            <p className="text-sm text-neutral-600 mb-4">
              Finance-specific settings for how invoices and credit notes appear on PDF.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Letterhead mode</label>
                <select
                  className={inputClass}
                  value={letterheadMode}
                  onChange={(e) => setLetterheadMode(e.target.value as InvoiceLetterheadMode)}
                >
                  <option value="preprinted">Pre-printed letterhead (blank top margin)</option>
                  <option value="embedded_logo">Embed company logo in PDF</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1.5">
                  Use pre-printed if you print on branded stationery. Choose embedded logo for fully
                  digital PDFs.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">VAT PIN</label>
                <input
                  className={inputClass}
                  value={vatPin}
                  onChange={(e) => setVatPin(e.target.value)}
                  placeholder="e.g. P051234567X"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">
                  Invoice legal name override
                </label>
                <input
                  className={inputClass}
                  value={invoiceLegalName}
                  onChange={(e) => setInvoiceLegalName(e.target.value)}
                  placeholder={snapshot.branding.legalName || snapshot.companyIdentity.orgName || 'Same as organisation name'}
                />
                <p className="text-xs text-neutral-500 mt-1.5">
                  Leave blank to use the payslip legal entity name from Company setup.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSettings()}
              className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save invoice settings
            </button>
          </section>

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
