'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Clock, Users, CreditCard } from 'lucide-react';

type Overview = {
  usage: {
    nativeAttempts: number;
    externalInvites: number;
    proctoringSnapshots: number;
    estimatedCostCents: number;
    byProvider: Array<{ provider: string; count: number }>;
  };
  templates: Array<{ id: string; name: string; totalAttempts: number; completed: number; avgScorePercent: number | null }>;
};

type Detail = {
  templateName: string;
  attempts: number;
  completed: number;
  completionRate: number;
  avgScorePercent: number | null;
  passRate: number | null;
  avgDurationMinutes: number | null;
  scoreDistribution: number[];
  items: Array<{
    questionId: string;
    prompt: string;
    type: string;
    attempts: number;
    difficultyIndex: number | null;
    discrimination: number | null;
    avgTimeSeconds: number | null;
  }>;
};

export function AnalyticsPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/assessments/analytics', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setOverview);
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    void fetch(`/api/assessments/analytics?templateId=${selected}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setDetail);
  }, [selected]);

  if (!overview) return <p className="text-sm text-[var(--dash-text-muted)]">Loading analytics…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Native attempts (30d)" value={overview.usage.nativeAttempts} />
        <Stat icon={<BarChart3 className="h-4 w-4" />} label="External invites (30d)" value={overview.usage.externalInvites} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Proctoring snapshots" value={overview.usage.proctoringSnapshots} />
        <Stat icon={<CreditCard className="h-4 w-4" />} label="Est. spend (30d)" value={`$${(overview.usage.estimatedCostCents / 100).toFixed(2)}`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--dash-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
            <tr>
              <th className="px-4 py-2">Template</th>
              <th className="px-4 py-2">Attempts</th>
              <th className="px-4 py-2">Completed</th>
              <th className="px-4 py-2">Avg score</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {overview.templates.map((t) => (
              <tr key={t.id} className="border-t border-[var(--dash-border-subtle)]">
                <td className="px-4 py-2 font-medium text-[var(--dash-text-strong)]">{t.name}</td>
                <td className="px-4 py-2">{t.totalAttempts}</td>
                <td className="px-4 py-2">{t.completed}</td>
                <td className="px-4 py-2">{t.avgScorePercent != null ? `${t.avgScorePercent.toFixed(1)}%` : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => setSelected(t.id === selected ? null : t.id)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
                    {selected === t.id ? 'Hide' : 'Item analysis'}
                  </button>
                </td>
              </tr>
            ))}
            {overview.templates.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--dash-text-muted)]">No assessment activity yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detail ? (
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--dash-text-strong)]">{detail.templateName} — insights</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-4 text-sm">
            <MiniStat label="Completion" value={`${detail.completionRate}%`} />
            <MiniStat label="Avg score" value={detail.avgScorePercent != null ? `${detail.avgScorePercent}%` : '—'} />
            <MiniStat label="Pass rate" value={detail.passRate != null ? `${detail.passRate}%` : '—'} />
            <MiniStat label="Avg time" value={detail.avgDurationMinutes != null ? `${detail.avgDurationMinutes}m` : '—'} />
          </div>

          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Score distribution</p>
            <Histogram buckets={detail.scoreDistribution} />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Item analysis</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[var(--dash-text-muted)]">
                  <tr><th className="py-1 pr-3">Question</th><th className="py-1 pr-3">Difficulty</th><th className="py-1 pr-3">Discrimination</th><th className="py-1">Avg time</th></tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.questionId} className="border-t border-[var(--dash-border-subtle)]">
                      <td className="max-w-xs truncate py-1.5 pr-3">{item.prompt}</td>
                      <td className="py-1.5 pr-3">{item.difficultyIndex != null ? item.difficultyIndex.toFixed(2) : '—'}</td>
                      <td className="py-1.5 pr-3">
                        <span className={item.discrimination != null && item.discrimination < 0.1 ? 'text-red-500' : ''}>
                          {item.discrimination != null ? item.discrimination.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="py-1.5">{item.avgTimeSeconds != null ? `${item.avgTimeSeconds}s` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[var(--dash-text-faint)]">Difficulty = proportion correct. Discrimination below 0.10 (red) flags weak items.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--dash-text-muted)]">{icon}<span className="text-xs">{label}</span></div>
      <p className="mt-1 text-2xl font-semibold text-[var(--dash-text-strong)]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--dash-surface-muted)] px-3 py-2">
      <p className="text-xs text-[var(--dash-text-muted)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--dash-text-strong)]">{value}</p>
    </div>
  );
}

function Histogram({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets);
  return (
    <div className="flex h-28 items-end gap-1">
      {buckets.map((count, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-[var(--brand-primary)]" style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 4 : 0 }} title={`${count} attempts`} />
          <span className="text-[9px] text-[var(--dash-text-faint)]">{i * 10}</span>
        </div>
      ))}
    </div>
  );
}
