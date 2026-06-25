'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTable, DashboardTableCard, DashboardTableEmpty, DashboardTableViewport } from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Site = { id: string; code: string };
type Subcontractor = {
  id: string;
  name: string;
  trade: string | null;
  siteCode: string | null;
  contractValue: number;
  amountInvoiced: number;
  amountPaid: number;
  retentionHeld: number;
  balanceDue: number;
  status: string;
};

export default function ConstructionSubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    siteId: '',
    name: '',
    trade: '',
    contractValue: '',
    retentionPct: '5',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [subRes, sitesRes] = await Promise.all([
      fetch('/api/construction/subcontractors'),
      fetch('/api/construction/sites'),
    ]);
    const subJson = await subRes.json();
    const sitesJson = await sitesRes.json();
    if (!subRes.ok) throw new Error(subJson.error || 'Failed');
    setSubcontractors(subJson.subcontractors ?? []);
    setSites(sitesJson.sites ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : 'Failed');
      setLoading(false);
    });
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/construction/subcontractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: form.siteId || undefined,
        name: form.name,
        trade: form.trade,
        contractValue: Number(form.contractValue) || 0,
        retentionPct: Number(form.retentionPct) || 0,
        amountInvoiced: Number(form.contractValue) * 0.4 || 0,
        amountPaid: Number(form.contractValue) * 0.2 || 0,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Create failed');
      return;
    }
    setForm({ siteId: '', name: '', trade: '', contractValue: '', retentionPct: '5' });
    await load();
  }

  if (loading && subcontractors.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Construction" title="Subcontractors" description="Subcontractor register with retention and accounts payable exposure." />
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-6">
        <select value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm">
          <option value="">Site (optional)</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.code}</option>
          ))}
        </select>
        <input required placeholder="Company name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input placeholder="Trade" value={form.trade} onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required type="number" placeholder="Contract value" value={form.contractValue} onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input type="number" placeholder="Retention %" value={form.retentionPct} onChange={(e) => setForm((f) => ({ ...f, retentionPct: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Add subcontractor</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Subcontractors" message={error} onRetry={() => void load()} /> : (
        <DashboardTableCard title="Subcontractor AP">
          <DashboardTableViewport>
            <DashboardTable>
              <thead><tr><th>Name</th><th>Trade</th><th>Site</th><th>Invoiced</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>
                {subcontractors.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.trade ?? '—'}</td>
                    <td>{s.siteCode ?? '—'}</td>
                    <td>KES {s.amountInvoiced.toLocaleString()}</td>
                    <td>KES {s.amountPaid.toLocaleString()}</td>
                    <td>KES {s.balanceDue.toLocaleString()}</td>
                    <td className="capitalize">{s.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {subcontractors.length === 0 ? <DashboardTableEmpty message="No subcontractors on file." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
