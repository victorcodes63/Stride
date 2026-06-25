'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type BudgetReport = {
  projectId: string;
  projectCode: string;
  projectName: string;
  currency: string;
  department: string | null;
  periodStart: string;
  periodEnd: string;
  budget: { id: string | null; name: string | null; allocated: number };
  actuals: { payroll: number; accountsPayable: number; expenses: number };
  totalActual: number;
  remaining: number;
  utilizationPercent: number;
  burnRateMonthly: number | null;
};

function fmtMoney(v: number, currency = 'KES') {
  return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

export default function ProjectBudgetContent() {
  const [reports, setReports] = useState<BudgetReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BudgetReport | null>(null);
  const [budgets, setBudgets] = useState<{ id: string; name: string }[]>([]);
  const [linkBudgetId, setLinkBudgetId] = useState('');
  const [linking, setLinking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/projects/budget-summary?status=active').then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data;
      }),
      fetch(`/api/finance/budgets?year=${new Date().getFullYear()}`).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return { budgets: [] };
        return data;
      }),
    ])
      .then(([summary, budgetData]) => {
        setReports(summary.reports ?? []);
        setBudgets(
          (budgetData.budgets ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })),
        );
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetch(`/api/projects/${selectedId}/budget`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed');
        return data.report as BudgetReport;
      })
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [selectedId]);

  async function linkBudget() {
    if (!selectedId || !linkBudgetId) return;
    setLinking(true);
    try {
      const r = await fetch(`/api/projects/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetId: linkBudgetId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Link failed');
      setLinkBudgetId('');
      load();
      setSelectedId(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setLinking(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Budget vs actual"
        description="Project burn from payroll (by department), procurement AP, and expense claims — linked to Finance budgets."
        icon={BarChart3}
      />

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading budget reports…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-2">
            {!reports?.length ? (
              <p className="text-sm text-[var(--dash-text-muted)]">No active projects to report on.</p>
            ) : (
              reports.map((r) => (
                <button
                  key={r.projectId}
                  type="button"
                  onClick={() => setSelectedId(r.projectId)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedId === r.projectId
                      ? 'border-[var(--brand-primary)] bg-[var(--dash-surface-solid)]'
                      : 'border-[var(--dash-border)] bg-[var(--dash-surface-solid)] hover:bg-[var(--dash-hover)]'
                  }`}
                >
                  <p className="font-medium text-[var(--dash-text-strong)]">{r.projectName}</p>
                  <p className="text-xs text-[var(--dash-text-muted)]">{r.projectCode} · {r.department ?? 'No dept'}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${r.utilizationPercent > 100 ? 'bg-red-500' : r.utilizationPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(r.utilizationPercent, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                    {r.utilizationPercent}% · {fmtMoney(r.totalActual, r.currency)} / {fmtMoney(r.budget.allocated, r.currency)}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5">
            {!detail ? (
              <p className="text-sm text-[var(--dash-text-muted)]">Select a project to see budget breakdown.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--dash-text-strong)]">{detail.projectName}</h3>
                  <p className="text-sm text-[var(--dash-text-muted)]">
                    {detail.periodStart} → {detail.periodEnd}
                    {detail.budget.name ? ` · Budget: ${detail.budget.name}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-[var(--dash-surface-muted)] p-3">
                    <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Allocated</p>
                    <p className="text-sm font-bold">{fmtMoney(detail.budget.allocated, detail.currency)}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--dash-surface-muted)] p-3">
                    <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Actual</p>
                    <p className="text-sm font-bold text-amber-700">{fmtMoney(detail.totalActual, detail.currency)}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--dash-surface-muted)] p-3">
                    <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Remaining</p>
                    <p className={`text-sm font-bold ${detail.remaining >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {fmtMoney(detail.remaining, detail.currency)}
                    </p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--dash-text-muted)]">
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1">Payroll (gross, dept match)</td>
                      <td className="py-1 text-right tabular-nums">{fmtMoney(detail.actuals.payroll, detail.currency)}</td>
                    </tr>
                    <tr>
                      <td className="py-1">Procurement / AP</td>
                      <td className="py-1 text-right tabular-nums">{fmtMoney(detail.actuals.accountsPayable, detail.currency)}</td>
                    </tr>
                    <tr>
                      <td className="py-1">Expense claims</td>
                      <td className="py-1 text-right tabular-nums">{fmtMoney(detail.actuals.expenses, detail.currency)}</td>
                    </tr>
                  </tbody>
                </table>

                {detail.burnRateMonthly != null ? (
                  <p className="text-xs text-[var(--dash-text-muted)]">
                    Avg burn: {fmtMoney(detail.burnRateMonthly, detail.currency)} / month
                  </p>
                ) : null}

                {budgets.length > 0 ? (
                  <div className="border-t border-[var(--dash-border)] pt-4">
                    <p className="mb-2 text-sm font-medium">Link Finance budget</p>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={linkBudgetId}
                        onChange={(e) => setLinkBudgetId(e.target.value)}
                        className="dash-auth-input min-w-[12rem]"
                      >
                        <option value="">Select budget…</option>
                        {budgets.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!linkBudgetId || linking}
                        onClick={linkBudget}
                        className="dash-auth-submit max-w-[8rem]"
                      >
                        {linking ? 'Saving…' : 'Link'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <Link href="/dashboard/accounts/budgets" className="text-sm text-[var(--brand-primary)] hover:underline">
                  Manage Finance budgets →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardPage>
  );
}
