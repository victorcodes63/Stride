'use client';

import { Suspense, useState } from 'react';
import { Download, FileText, Mail } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTableToolbar } from '@/components/dashboard/DashboardDataTable';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

function OutsourcingReportsContent() {
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reportUrl() {
    if (!clientId) return '#';
    const params = new URLSearchParams({ month, year });
    return `/api/outsourcing/clients/${clientId}/reports/monthly?${params.toString()}`;
  }

  async function sendReport() {
    if (!clientId) {
      setError('Select an end-client first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/reports/monthly/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: Number(month), year: Number(year) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send report.');
      const recipients = Array.isArray(data.recipients) ? data.recipients.join(', ') : 'recipients';
      setMessage(`Report emailed to ${recipients}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        icon={FileText}
        title="White-label reports"
        description="Download or email monthly client packs branded for each end-client."
      />

      {showSwitcher ? (
        <div className="mb-4 overflow-hidden dashboard-surface shadow-sm">
          <DashboardTableToolbar>
            <OutsourcingClientSwitcher
              clients={clients}
              value={clientId}
              onChange={setClientId}
              className={dashboardFilterSelectClass}
            />
          </DashboardTableToolbar>
        </div>
      ) : null}

      <div className="dashboard-surface shadow-sm p-4 sm:p-6 max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-neutral-800">Month</span>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-neutral-800">Year</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={clientId ? reportUrl() : undefined}
            aria-disabled={!clientId}
            className={`inline-flex items-center gap-2 rounded-xl bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 ${
              !clientId ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <button
            type="button"
            disabled={busy || !clientId}
            onClick={() => void sendReport()}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-900 hover:bg-primary-100 disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            {busy ? 'Sending…' : 'Email to client'}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {!clientId ? (
          <p className="mt-3 text-sm text-neutral-600">Select an end-client to generate a report.</p>
        ) : null}
      </div>
    </DashboardPage>
  );
}

export default function OutsourcingReportsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading reports…</div>}>
      <OutsourcingReportsContent />
    </Suspense>
  );
}
