'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTable, DashboardTableCard, DashboardTableEmpty, DashboardTableViewport } from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Site = { id: string; code: string; name: string };
type Plant = {
  id: string;
  assetTag: string;
  name: string;
  siteCode: string | null;
  category: string | null;
  status: string;
  dailyHireRate: number | null;
};

export default function ConstructionPlantPage() {
  const [plant, setPlant] = useState<Plant[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ siteId: '', assetTag: '', name: '', category: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [plantRes, sitesRes] = await Promise.all([
      fetch('/api/construction/plant'),
      fetch('/api/construction/sites'),
    ]);
    const plantJson = await plantRes.json();
    const sitesJson = await sitesRes.json();
    if (!plantRes.ok) throw new Error(plantJson.error || 'Failed');
    setPlant(plantJson.plant ?? []);
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
    const res = await fetch('/api/construction/plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Create failed');
      return;
    }
    setForm({ siteId: '', assetTag: '', name: '', category: '' });
    await load();
  }

  if (loading && plant.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Construction" title="Plant assets" description="Excavators, cranes, and hired plant assigned to active sites." />
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-5">
        <select required value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm">
          <option value="">Site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.code}</option>
          ))}
        </select>
        <input required placeholder="Asset tag" value={form.assetTag} onChange={(e) => setForm((f) => ({ ...f, assetTag: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Add plant</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Plant" message={error} onRetry={() => void load()} /> : (
        <DashboardTableCard title="Plant register">
          <DashboardTableViewport>
            <DashboardTable>
              <thead><tr><th>Tag</th><th>Name</th><th>Site</th><th>Category</th><th>Status</th><th>Hire/day</th></tr></thead>
              <tbody>
                {plant.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.assetTag}</td>
                    <td>{p.name}</td>
                    <td>{p.siteCode ?? '—'}</td>
                    <td>{p.category ?? '—'}</td>
                    <td className="capitalize">{p.status.replace('_', ' ')}</td>
                    <td>{p.dailyHireRate != null ? `KES ${p.dailyHireRate.toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {plant.length === 0 ? <DashboardTableEmpty message="No plant on register." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
