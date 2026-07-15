'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, Plus, UserSearch } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  owner: { id: string; name: string } | null;
  convertedDealId: string | null;
  convertedDeal: { id: string; name: string; stage: string } | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
  converted: 'Converted',
};

export default function SalesLeadsContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [convertMsg, setConvertMsg] = useState<{ leadId: string; dealId: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/sales/leads')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data.leads as Lead[];
      })
      .then(setLeads)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setLeads([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function convertLead(id: string) {
    setConverting(id);
    setError(null);
    setConvertMsg(null);
    try {
      const r = await fetch(`/api/sales/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Convert failed');
      const dealId = data.deal?.id as string | undefined;
      if (dealId) setConvertMsg({ leadId: id, dealId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Convert failed');
    } finally {
      setConverting(null);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Leads"
        description="Capture prospects and convert them into pipeline deals."
        icon={UserSearch}
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add lead
          </button>
        }
      />

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
        </div>
      ) : leads.length === 0 ? (
        <div className={`${DASHBOARD_SURFACE_CLASS} px-6 py-12 text-center`}>
          <UserSearch className="mx-auto h-8 w-8 text-[var(--stride-coral)]" />
          <p className="mt-3 font-semibold text-[var(--dash-text-strong)]">No leads yet</p>
          <p className="mt-1 text-sm text-[var(--dash-text-muted)]">
            Add a prospect to start the funnel before the pipeline.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Create lead
          </button>
        </div>
      ) : (
        <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-[var(--dash-border)]">
                  <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                    {lead.name}
                  </td>
                  <td className="px-4 py-3">{lead.company ?? '—'}</td>
                  <td className="px-4 py-3">{lead.email ?? '—'}</td>
                  <td className="px-4 py-3">{lead.source ?? '—'}</td>
                  <td className="px-4 py-3">
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </td>
                  <td className="px-4 py-3">{lead.owner?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {lead.status === 'converted' && (lead.convertedDealId || lead.convertedDeal) ? (
                      <Link
                        href="/dashboard/sales/deals"
                        className="text-sm font-medium text-[var(--stride-coral)]"
                      >
                        View deal →
                      </Link>
                    ) : lead.status !== 'disqualified' ? (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={converting === lead.id}
                          onClick={() => void convertLead(lead.id)}
                          className="rounded border border-[var(--dash-border)] px-2 py-1 text-xs font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-60"
                        >
                          {converting === lead.id ? 'Converting…' : 'Convert'}
                        </button>
                        {convertMsg?.leadId === lead.id ? (
                          <Link
                            href="/dashboard/sales/deals"
                            className="text-xs font-medium text-[var(--stride-coral)]"
                          >
                            Open deal →
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <CreateLeadModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      ) : null}
    </DashboardPage>
  );
}

function CreateLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/sales/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          company: company || undefined,
          email: email || undefined,
          source: source || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Create failed');
      onCreated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">New lead</h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Company
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Source
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Referral, inbound, event…"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
