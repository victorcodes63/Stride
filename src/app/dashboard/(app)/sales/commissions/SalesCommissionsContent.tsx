'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Coins, Loader2, Send } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type Estimate = {
  employeeId: string;
  employeeName?: string;
  attainmentPct: number | null;
  revenue: number;
  commissionAmount: number;
  currency: string;
  ruleName: string;
  payrollStatus?: string | null;
  alreadyPushed?: boolean;
  payrollId?: string | null;
};

type PushResult = {
  pushed: Array<{ employeeId: string; payrollId: string; amount: number }>;
  skipped: Array<{ employeeId: string; reason: string }>;
  month: number;
  year: number;
};

function defaultSelectedIds(rows: Estimate[]) {
  return rows
    .filter((e) => e.commissionAmount > 0 && !e.alreadyPushed)
    .map((e) => e.employeeId);
}

function payrollStatusLabel(status: string | null | undefined) {
  if (!status) return 'none';
  return status.replace(/_/g, ' ');
}

export default function SalesCommissionsContent() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canPushToPayroll, setCanPushToPayroll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of estimates) {
      map[e.employeeId] = e.employeeName ?? e.employeeId.slice(0, 8);
    }
    return map;
  }, [estimates]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/sales/commissions')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed');
        setCanPushToPayroll(data.canPushToPayroll === true);
        return data.estimates as Estimate[];
      })
      .then((rows) => {
        setEstimates(rows);
        setSelectedIds(defaultSelectedIds(rows));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setEstimates([]);
        setSelectedIds([]);
        setCanPushToPayroll(false);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    const eligible = defaultSelectedIds(estimates);
    const allEligibleSelected =
      eligible.length > 0 && eligible.every((id) => selectedIds.includes(id));
    setSelectedIds(allEligibleSelected ? [] : eligible);
  }

  async function pushToPayroll() {
    if (selectedIds.length === 0) return;
    setPushing(true);
    setError(null);
    setPushResult(null);
    try {
      const r = await fetch('/api/sales/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push_to_payroll',
          employeeIds: selectedIds,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Push failed');
      setPushResult(data.result as PushResult);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push failed');
    } finally {
      setPushing(false);
    }
  }

  const allEligibleSelected =
    estimates.filter((e) => e.commissionAmount > 0 && !e.alreadyPushed).length > 0 &&
    estimates
      .filter((e) => e.commissionAmount > 0 && !e.alreadyPushed)
      .every((e) => selectedIds.includes(e.employeeId));

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Commissions"
        description="Estimated incentive payouts from attainment tiers. Push to draft payroll when ready."
        icon={Coins}
        actions={
          canPushToPayroll ? (
            <button
              type="button"
              disabled={pushing || selectedIds.length === 0}
              onClick={() => void pushToPayroll()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {pushing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Push to payroll
              {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </button>
          ) : undefined
        }
      />

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {pushResult ? (
        <div className="mb-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-4 py-3 text-sm text-[var(--dash-text-strong)]">
          Pushed {pushResult.pushed.length} to payroll ({pushResult.year}-
          {String(pushResult.month).padStart(2, '0')}). Skipped {pushResult.skipped.length}.
          {pushResult.pushed.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-[var(--dash-text-muted)]">
              {pushResult.pushed.map((p) => (
                <li key={p.employeeId}>
                  {nameById[p.employeeId] ?? p.employeeId.slice(0, 8)} —{' '}
                  {p.amount.toLocaleString('en-KE')}
                </li>
              ))}
            </ul>
          ) : null}
          {pushResult.skipped.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-[var(--dash-text-muted)]">
              {pushResult.skipped.slice(0, 8).map((s) => (
                <li key={`${s.employeeId}-${s.reason}`}>
                  {nameById[s.employeeId] ?? s.employeeId.slice(0, 8)} — {s.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : estimates.length === 0 ? (
        <div className={`${DASHBOARD_SURFACE_CLASS} px-6 py-12 text-center`}>
          <Coins className="mx-auto h-8 w-8 text-[var(--stride-coral)]" />
          <p className="mt-3 font-semibold text-[var(--dash-text-strong)]">No estimates yet</p>
          <p className="mt-1 text-sm text-[var(--dash-text-muted)]">
            Need an active commission rule plus closed revenue for the period.
          </p>
          <Link
            href="/dashboard/sales/attainment"
            className="mt-4 inline-block text-sm font-medium text-[var(--stride-coral)]"
          >
            View attainment →
          </Link>
        </div>
      ) : (
        <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
              <tr>
                <th className="px-4 py-3">
                  {canPushToPayroll ? (
                    <input
                      type="checkbox"
                      checked={allEligibleSelected}
                      onChange={toggleAll}
                      aria-label="Select all eligible reps"
                      className="rounded border-[var(--dash-border)]"
                    />
                  ) : null}
                </th>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3">Attainment</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Payroll status</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => {
                const checked = selectedIds.includes(e.employeeId);
                const status = payrollStatusLabel(e.payrollStatus);
                return (
                  <tr key={e.employeeId} className="border-t border-[var(--dash-border)]">
                    <td className="px-4 py-3">
                      {canPushToPayroll ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(e.employeeId)}
                          aria-label={`Select ${e.employeeName ?? e.employeeId}`}
                          className="rounded border-[var(--dash-border)]"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                      {e.employeeName ?? e.employeeId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      {e.attainmentPct != null ? `${e.attainmentPct}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {e.revenue.toLocaleString('en-KE')} {e.currency}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--stride-coral)]">
                      {e.commissionAmount.toLocaleString('en-KE')} {e.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex flex-wrap items-center gap-1.5 capitalize">
                        {status}
                        {e.alreadyPushed ? (
                          <span className="rounded bg-[var(--dash-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                            pushed
                          </span>
                        ) : null}
                      </span>
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
