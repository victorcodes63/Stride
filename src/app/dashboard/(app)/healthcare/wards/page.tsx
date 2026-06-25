'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTable, DashboardTableCard, DashboardTableEmpty, DashboardTableViewport } from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Ward = {
  id: string;
  code: string;
  name: string;
  requiredCredentials: string[];
  minRestHours: number;
};

export default function HealthcareWardsPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', minRestHours: '11' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/healthcare/wards');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed');
    setWards(json.wards ?? []);
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
    const res = await fetch('/api/healthcare/wards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        minRestHours: Number(form.minRestHours),
        requiredCredentials: ['medical_license'],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Create failed');
      return;
    }
    setForm({ code: '', name: '', minRestHours: '11' });
    await load();
  }

  if (loading && wards.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Healthcare" title="Wards & clinical rules" description="Each ward defines required licences and minimum rest between shifts." />
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-4">
        <input required placeholder="Code e.g. ICU" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required placeholder="Ward name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <input required type="number" min={8} max={24} placeholder="Min rest (h)" value={form.minRestHours} onChange={(e) => setForm((f) => ({ ...f, minRestHours: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Add ward</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Wards" message={error} onRetry={() => void load()} /> : (
        <DashboardTableCard title="Wards">
          <DashboardTableViewport>
            <DashboardTable>
              <thead><tr><th>Code</th><th>Name</th><th>Licences</th><th>Min rest</th></tr></thead>
              <tbody>
                {wards.map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs">{w.code}</td>
                    <td>{w.name}</td>
                    <td className="text-xs">{w.requiredCredentials.join(', ') || '—'}</td>
                    <td>{w.minRestHours}h</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {wards.length === 0 ? <DashboardTableEmpty message="No wards configured." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
