'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTable, DashboardTableCard, DashboardTableEmpty, DashboardTableViewport } from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Site = {
  id: string;
  code: string;
  name: string;
  region: string | null;
  operatingEntityLabel: string | null;
};

export default function EnergySitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', region: '', operatingEntityLabel: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/energy/sites');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed');
    setSites(json.sites ?? []);
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
    const res = await fetch('/api/energy/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Create failed');
      return;
    }
    setForm({ code: '', name: '', region: '', operatingEntityLabel: '' });
    await load();
  }

  if (loading && sites.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Energy" title="Sites" description="Depot, station, and field sites with entity labels for group HSE rollup." />
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-5">
        <input required placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required placeholder="Site name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input placeholder="Region" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input placeholder="Entity label" value={form.operatingEntityLabel} onChange={(e) => setForm((f) => ({ ...f, operatingEntityLabel: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Add site</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Sites" message={error} onRetry={() => void load()} /> : (
        <DashboardTableCard title="Energy sites">
          <DashboardTableViewport>
            <DashboardTable>
              <thead><tr><th>Code</th><th>Name</th><th>Region</th><th>Entity</th></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.code}</td>
                    <td>{s.name}</td>
                    <td>{s.region ?? '—'}</td>
                    <td>{s.operatingEntityLabel ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {sites.length === 0 ? <DashboardTableEmpty message="No sites configured." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
