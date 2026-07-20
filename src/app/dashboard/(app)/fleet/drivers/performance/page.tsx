'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, UserCheck } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { StrideSelect } from '@/components/ui/stride-select';

type DriverSummary = {
  driverId: string;
  driverName: string;
  avgOverall: number | null;
  avgSafety: number | null;
  evaluationCount: number;
};

type Evaluation = {
  id: string;
  driverName: string;
  tripNumber: string | null;
  scoreOverall: number;
  scoreSafety: number | null;
  scorePunctuality: number | null;
  evaluatedAt: string;
};

type DriverOption = { id: string; fullName: string };

export default function FleetDriverPerformancePage() {
  const [summaries, setSummaries] = useState<DriverSummary[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/fleet/driver-evaluations')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load driver performance.');
        const json = (await r.json()) as {
          driverSummaries: DriverSummary[];
          evaluations: Evaluation[];
        };
        setSummaries(json.driverSummaries);
        setEvaluations(json.evaluations);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Driver performance"
        description="Driver scores — safety, punctuality, fuel efficiency, and feedback."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add evaluation
          </button>
        }
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <DashboardStatGrid>
            <DashboardMetricCard label="Drivers rated" value={summaries.length} icon={UserCheck} />
            <DashboardMetricCard label="Evaluations" value={evaluations.length} icon={UserCheck} />
          </DashboardStatGrid>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Driver scorecard</h2>
              </div>
              <DashboardTableViewport>
                {summaries.length === 0 ? (
                  <DashboardTableEmpty title="No evaluations yet" description="Score drivers after trip completion.">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                    >
                      <Plus className="h-4 w-4" /> Add evaluation
                    </button>
                  </DashboardTableEmpty>
                ) : (
                  <DashboardTable>
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Overall</th>
                        <th>Safety</th>
                        <th>Reviews</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map((s) => (
                        <tr key={s.driverId}>
                          <td className="col-primary font-medium">{s.driverName}</td>
                          <td>{s.avgOverall ?? '—'}</td>
                          <td>{s.avgSafety ?? '—'}</td>
                          <td>{s.evaluationCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </DashboardTable>
                )}
              </DashboardTableViewport>
            </DashboardTableCard>

            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Recent evaluations</h2>
              </div>
              <DashboardTableViewport>
                {evaluations.length === 0 ? (
                  <DashboardTableEmpty title="No recent evaluations" />
                ) : (
                  <DashboardTable>
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Trip</th>
                        <th>Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluations.slice(0, 15).map((e) => (
                        <tr key={e.id}>
                          <td className="font-medium">{e.driverName}</td>
                          <td>{e.tripNumber ?? '—'}</td>
                          <td>{e.scoreOverall}/100</td>
                          <td className="col-muted text-sm">{new Date(e.evaluatedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </DashboardTable>
                )}
              </DashboardTableViewport>
            </DashboardTableCard>
          </div>
        </>
      </DashboardAsyncState>

      {createOpen ? (
        <CreateEvaluationModal
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

function CreateEvaluationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverId, setDriverId] = useState('');
  const [scoreOverall, setScoreOverall] = useState('80');
  const [scoreSafety, setScoreSafety] = useState('');
  const [scorePunctuality, setScorePunctuality] = useState('');
  const [scoreFuelEfficiency, setScoreFuelEfficiency] = useState('');
  const [scoreCustomer, setScoreCustomer] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/drivers')
      .then(async (r) => (r.ok ? ((await r.json()) as DriverOption[]) : []))
      .then((d) => {
        setDrivers(d);
        if (d[0]) setDriverId(d[0].id);
      })
      .catch(() => setDrivers([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/fleet/driver-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          scoreOverall: Number(scoreOverall),
          scoreSafety: scoreSafety ? Number(scoreSafety) : undefined,
          scorePunctuality: scorePunctuality ? Number(scorePunctuality) : undefined,
          scoreFuelEfficiency: scoreFuelEfficiency ? Number(scoreFuelEfficiency) : undefined,
          scoreCustomer: scoreCustomer ? Number(scoreCustomer) : undefined,
          notes: notes || undefined,
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--dash-text-strong)]">
          <UserCheck className="h-5 w-5 text-[var(--stride-coral)]" />
          New evaluation
        </h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Driver
          <StrideSelect
            value={driverId}
            onChange={(value) => setDriverId(value)}
            options={
              drivers.length === 0
                ? [{ value: '', label: 'No drivers found' }]
                : drivers.map((d) => ({ value: d.id, label: d.fullName }))
            }
            ariaLabel="Driver"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Overall score (0–100)
          <input
            required
            type="number"
            min={0}
            max={100}
            value={scoreOverall}
            onChange={(e) => setScoreOverall(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Safety
            <input
              type="number"
              min={0}
              max={100}
              value={scoreSafety}
              onChange={(e) => setScoreSafety(e.target.value)}
              placeholder="Optional"
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Punctuality
            <input
              type="number"
              min={0}
              max={100}
              value={scorePunctuality}
              onChange={(e) => setScorePunctuality(e.target.value)}
              placeholder="Optional"
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Fuel efficiency
            <input
              type="number"
              min={0}
              max={100}
              value={scoreFuelEfficiency}
              onChange={(e) => setScoreFuelEfficiency(e.target.value)}
              placeholder="Optional"
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Customer
            <input
              type="number"
              min={0}
              max={100}
              value={scoreCustomer}
              onChange={(e) => setScoreCustomer(e.target.value)}
              placeholder="Optional"
              className="dash-auth-input mt-1 w-full"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
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
            disabled={saving || !driverId}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
