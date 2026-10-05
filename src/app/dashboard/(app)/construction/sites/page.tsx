'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ConstructionSiteTable, type ConstructionSiteRow } from '@/components/construction/ConstructionSiteTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';
import { StrideSelect } from '@/components/ui/stride-select';

type Site = ConstructionSiteRow;

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
        <StrideSelect
          value={form.status}
          onChange={(value) => setForm((f) => ({ ...f, status: value }))}
          options={[
            { value: 'planning', label: 'Planning' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'completed', label: 'Completed' },
          ]}
          ariaLabel="Status"
        />
        <StrideSelect
          value={form.parentSiteId}
          onChange={(value) => setForm((f) => ({ ...f, parentSiteId: value }))}
          options={[
            { value: '', label: 'No parent' },
            ...sites.map((s) => ({ value: s.id, label: s.code })),
          ]}
          ariaLabel="Parent site"
        />
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Add site</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Sites" message={error} onRetry={() => void load()} /> : (
        <ConstructionSiteTable sites={sites} />
      )}
    </DashboardPage>
  );
}
