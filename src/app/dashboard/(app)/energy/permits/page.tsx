'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTable, DashboardTableCard, DashboardTableEmpty, DashboardTableViewport } from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Site = { id: string; code: string; name: string };
type Permit = {
  id: string;
  permitNumber: string;
  siteCode: string | null;
  permitType: string;
  issuingAuthority: string;
  expiresAt: string;
  status: string;
};

export default function EnergyPermitsPage() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    siteId: '',
    permitNumber: '',
    issuingAuthority: '',
    issuedAt: '',
    expiresAt: '',
    permitType: 'operating',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [permitsRes, sitesRes] = await Promise.all([
      fetch('/api/energy/permits'),
      fetch('/api/energy/sites'),
    ]);
    const permitsJson = await permitsRes.json();
    const sitesJson = await sitesRes.json();
    if (!permitsRes.ok) throw new Error(permitsJson.error || 'Failed');
    setPermits(permitsJson.permits ?? []);
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
    const res = await fetch('/api/energy/permits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Create failed');
      return;
    }
    setForm({
      siteId: '',
      permitNumber: '',
      issuingAuthority: '',
      issuedAt: '',
      expiresAt: '',
      permitType: 'operating',
    });
    await load();
  }

  if (loading && permits.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Energy" title="Permits" description="Environmental, operating, and safety permits with expiry tracking." />
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-3 lg:grid-cols-6">
        <select required value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm">
          <option value="">Site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
          ))}
        </select>
        <input required placeholder="Permit #" value={form.permitNumber} onChange={(e) => setForm((f) => ({ ...f, permitNumber: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required placeholder="Authority" value={form.issuingAuthority} onChange={(e) => setForm((f) => ({ ...f, issuingAuthority: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required type="date" value={form.issuedAt} onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Add permit</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Permits" message={error} onRetry={() => void load()} /> : (
        <DashboardTableCard title="Permit register">
          <DashboardTableViewport>
            <DashboardTable>
              <thead><tr><th>Permit</th><th>Site</th><th>Type</th><th>Authority</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody>
                {permits.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.permitNumber}</td>
                    <td>{p.siteCode ?? '—'}</td>
                    <td className="capitalize">{p.permitType.replace('_', ' ')}</td>
                    <td>{p.issuingAuthority}</td>
                    <td>{p.expiresAt}</td>
                    <td className="capitalize">{p.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {permits.length === 0 ? <DashboardTableEmpty message="No permits on file." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
