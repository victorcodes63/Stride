'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2, Target } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type TargetRow = {
  id: string;
  employee: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: string;
};

type AttainmentRep = {
  employeeId?: string;
  employeeName: string;
  actual: number;
  target: number;
  attainmentPct: number | null;
};

export default function SalesTargetsContent() {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [attainmentByName, setAttainmentByName] = useState<Record<string, AttainmentRep>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManageSalesTargets, setCanManageSalesTargets] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/sales/targets').then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data.targets as TargetRow[];
      }),
      fetch('/api/sales/attainment')
        .then(async (r) => (r.ok ? r.json() : null))
        .then((data) => (data?.report?.leaderboard as AttainmentRep[]) ?? [])
        .catch(() => [] as AttainmentRep[]),
    ])
      .then(([t, board]) => {
        setTargets(t);
        const map: Record<string, AttainmentRep> = {};
        for (const row of board) {
          map[row.employeeName] = row;
        }
        setAttainmentByName(map);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setTargets([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setCanManageSalesTargets(data?.canManageSalesTargets === true);
      })
      .catch(() => {
        if (!cancelled) setCanManageSalesTargets(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function approve(id: string) {
    await fetch(`/api/sales/targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    load();
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales targets"
        description="Set and approve quotas per rep or team. Approved targets feed attainment and Performance scorecards."
        icon={Target}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading targets…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : targets.length === 0 ? (
        <div className={`${DASHBOARD_SURFACE_CLASS} px-6 py-12 text-center`}>
          <Target className="mx-auto h-8 w-8 text-[var(--stride-coral)]" />
          <p className="mt-3 font-semibold text-[var(--dash-text-strong)]">No quotas yet</p>
          <p className="mt-1 text-sm text-[var(--dash-text-muted)]">
            Seed demo sales data or create targets for this period.
          </p>
          <Link
            href="/dashboard/sales"
            className="mt-4 inline-block text-sm font-medium text-[var(--stride-coral)]"
          >
            Back to sales overview →
          </Link>
        </div>
      ) : (
        <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
              <tr>
                <th className="px-4 py-3">Rep / team</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Quota</th>
                <th className="px-4 py-3">Attainment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const name = t.employee?.name ?? t.department?.name ?? '—';
                const att = attainmentByName[name];
                const pct = att?.attainmentPct;
                const barWidth = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
                const tone =
                  pct == null
                    ? 'bg-neutral-300'
                    : pct >= 100
                      ? 'bg-emerald-500'
                      : pct >= 70
                        ? 'bg-[var(--stride-coral)]'
                        : 'bg-amber-500';
                return (
                  <tr key={t.id} className="border-t border-[var(--dash-border)]">
                    <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">{name}</td>
                    <td className="px-4 py-3">
                      {t.periodStart} → {t.periodEnd}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {t.amount.toLocaleString('en-KE')} {t.currency}
                    </td>
                    <td className="px-4 py-3 min-w-[10rem]">
                      <div className="mb-1 text-xs text-[var(--dash-text-muted)]">
                        {pct != null ? `${pct}%` : '—'}
                        {att ? ` · ${att.actual.toLocaleString('en-KE')} closed` : ''}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${barWidth}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{t.status.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right">
                      {t.status === 'pending_approval' && canManageSalesTargets ? (
                        <button
                          type="button"
                          onClick={() => approve(t.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--stride-coral)] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPage>
  );
}
