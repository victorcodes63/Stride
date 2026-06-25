'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Briefcase, LayoutGrid, ListTodo, Loader2, AlertCircle } from 'lucide-react';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';
import { DashboardPageSection } from '@/components/dashboard/DashboardPage';

type DashboardData = {
  summary: {
    total: number;
    active: number;
    openTasks: number;
    overdueTasks: number;
    milestonesDone: number;
    milestonesTotal: number;
  };
  statusBreakdown: Record<string, number>;
  burnTop: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    currency: string;
    utilizationPercent: number;
    totalActual: number;
    budget: { allocated: number };
    burnRateMonthly: number | null;
  }>;
  deliverables: Array<{
    projectId: string;
    projectCode: string;
    name: string;
    status: string;
    dueDate: string | null;
    milestones: { done: number; total: number };
    openTasks: number;
  }>;
  tasksDueSoon: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    project?: { projectCode: string; name: string };
  }>;
};

function fmtMoney(v: number, currency = 'KES') {
  return v.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + currency;
}

export default function ProjectsOverviewContent() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/projects/dashboard', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load dashboard');
        return data as DashboardData;
      })
      .then(setDash)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setDash(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-0">
      <ModuleHomeContent domainId="projects" />

      <DashboardPageSection className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--dash-text-strong)]">Execution dashboard</h2>
            <p className="text-sm text-[var(--dash-text-muted)]">Burn rate, deliverables, and upcoming deadlines.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/projects/board" className="dash-auth-submit max-w-none px-4 py-2 text-sm">
              <LayoutGrid className="mr-1.5 inline h-4 w-4" />
              Project board
            </Link>
            <Link
              href="/dashboard/projects/budget"
              className="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
            >
              <BarChart3 className="mr-1.5 inline h-4 w-4" />
              Budget vs actual
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--dash-text-muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading dashboard…
          </div>
        ) : dash ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
                  <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Milestones</p>
                  <p className="text-lg font-bold">
                    {dash.summary.milestonesDone}/{dash.summary.milestonesTotal}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
                  <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Open tasks</p>
                  <p className="text-lg font-bold">{dash.summary.openTasks}</p>
                </div>
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
                  <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Overdue</p>
                  <p className={`text-lg font-bold ${dash.summary.overdueTasks > 0 ? 'text-red-600' : ''}`}>
                    {dash.summary.overdueTasks}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
                  <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Active</p>
                  <p className="text-lg font-bold">{dash.summary.active}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <Briefcase className="h-4 w-4" />
                  Deliverable status
                </h3>
                {!dash.deliverables.length ? (
                  <p className="text-sm text-[var(--dash-text-muted)]">No projects with milestones or tasks yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {dash.deliverables.map((d) => {
                      const pct = d.milestones.total
                        ? Math.round((d.milestones.done / d.milestones.total) * 100)
                        : 0;
                      return (
                        <li key={d.projectId}>
                          <Link
                            href={`/dashboard/projects/all`}
                            className="block rounded-lg border border-[var(--dash-border)] px-3 py-2 hover:bg-[var(--dash-hover)]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-[var(--dash-text-strong)]">
                                {d.projectCode} — {d.name}
                              </span>
                              <span className="text-xs text-[var(--dash-text-muted)]">{pct}% milestones</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                              {d.openTasks} open tasks{d.dueDate ? ` · due ${d.dueDate}` : ''}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <BarChart3 className="h-4 w-4" />
                  Burn rate (active projects)
                </h3>
                {!dash.burnTop.length ? (
                  <p className="text-sm text-[var(--dash-text-muted)]">No active projects with budget data.</p>
                ) : (
                  <ul className="space-y-3">
                    {dash.burnTop.map((b) => (
                      <li key={b.projectId}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[var(--dash-text-strong)]">{b.projectName}</span>
                          <span
                            className={
                              b.utilizationPercent > 100
                                ? 'text-red-600'
                                : b.utilizationPercent > 80
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                            }
                          >
                            {b.utilizationPercent}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className={`h-full rounded-full ${b.utilizationPercent > 100 ? 'bg-red-500' : b.utilizationPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(b.utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                          {fmtMoney(b.totalActual, b.currency)} / {fmtMoney(b.budget.allocated, b.currency)}
                          {b.burnRateMonthly != null ? ` · ${fmtMoney(b.burnRateMonthly, b.currency)}/mo` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <ListTodo className="h-4 w-4" />
                  Due in 14 days
                </h3>
                {!dash.tasksDueSoon.length ? (
                  <p className="text-sm text-[var(--dash-text-muted)]">No upcoming task deadlines.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {dash.tasksDueSoon.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2 border-b border-[var(--dash-border)] pb-2 last:border-0">
                        <span className="text-[var(--dash-text-strong)]">{t.title}</span>
                        <span className="shrink-0 text-xs text-[var(--dash-text-muted)]">
                          {t.dueDate ?? '—'}
                          {t.project ? ` · ${t.project.projectCode}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/dashboard/projects/tasks" className="mt-3 inline-block text-sm text-[var(--brand-primary)] hover:underline">
                  All tasks →
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardPageSection>
    </div>
  );
}
