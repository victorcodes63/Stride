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
  status: string;
  parentSiteCode: string | null;
  projectCode: string | null;
  childCount: number;
};

export default function ConstructionSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', status: 'active', parentSiteId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/construction/sites');
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
    const res = await fetch('/api/construction/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        parentSiteId: form.parentSiteId || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Create failed');
      return;
    }
    setForm({ code: '', name: '', status: 'active', parentSiteId: '' });
    await load();
  }

  if (loading && sites.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Construction" title="Site hierarchy" description="Parent sites, phases, and project links for multi-site programmes." />
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-5">
        <input required placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required placeholder="Site name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm">
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="completed">Completed</option>
        </select>
        <select value={form.parentSiteId} onChange={(e) => setForm((f) => ({ ...f, parentSiteId: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm">
          <option value="">No parent</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.code}</option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Add site</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Sites" message={error} onRetry={() => void load()} /> : (
        <DashboardTableCard title="Construction sites">
          <DashboardTableViewport>
            <DashboardTable>
              <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Parent</th><th>Project</th><th>Children</th></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.code}</td>
                    <td>{s.name}</td>
                    <td className="capitalize">{s.status}</td>
                    <td>{s.parentSiteCode ?? '—'}</td>
                    <td>{s.projectCode ?? '—'}</td>
                    <td>{s.childCount}</td>
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
