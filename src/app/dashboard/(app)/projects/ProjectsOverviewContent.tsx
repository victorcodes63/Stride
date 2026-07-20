'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Briefcase,
  Download,
  LayoutGrid,
  ListTodo,
  Target,
} from 'lucide-react';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';
import { DashboardPageSection } from '@/components/dashboard/DashboardPage';
import {
  ProjectHealthBars,
  ProjectStatusMixChart,
  ProjectVelocityChart,
  ProjectWorkloadChart,
} from '@/components/dashboard/projects/ProjectCharts';
import { ProjectEmptyState, ProjectSkeleton, ProjectStatSkeleton } from '@/components/dashboard/projects/ProjectEmptyState';
import { toast } from '@/components/ui/toast';
import { HEALTH_LABEL, HEALTH_STYLES, initials } from '@/app/dashboard/(app)/projects/_lib/constants';
import type { ProjectHealth } from '@/types/projects';
import type { VelocityWeek } from '@/lib/projects/velocity';

type PortfolioData = {
  summary: {
    totalProjects: number;
    totalTasks: number;
    doneTasks: number;
    completionPercent: number;
  };
  statusCounts: Record<string, number>;
  healthCounts: Record<string, number>;
  atRisk: Array<{
    id: string;
    projectCode: string;
    name: string;
    status: string;
    health: ProjectHealth;
    dueDate: string | null;
    owner: { id: string; name: string } | null;
    overdueTaskCount: number;
    budgetUtilizationPercent: number | null;
    reasons: string[];
  }>;
  workload: Array<{
    userId: string;
    name: string | null;
    openTaskCount: number;
    estimateHours: number;
  }>;
  upcomingMilestones: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    progress: number;
    project: { id: string; projectCode: string; name: string } | null;
  }>;
};

type AnalyticsData = {
  velocity: VelocityWeek[];
  statusMix: Record<string, number>;
  openOverdue: number;
  openTotal: number;
};

type DashboardData = {
  summary: {
    openTasks: number;
    overdueTasks: number;
    milestonesDone: number;
    milestonesTotal: number;
  };
  burnTop: Array<{
    projectId: string;
    projectName: string;
    currency: string;
    utilizationPercent: number;
    totalActual: number;
    budget: { allocated: number };
    burnRateMonthly: number | null;
  }>;
  tasksDueSoon: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    project?: { projectCode: string; name: string };
  }>;
};

function fmtMoney(v: number, currency = 'KES') {
  return (
    v.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) +
    ' ' +
    currency
  );
}

function reasonLabel(r: string): string {
  if (r.startsWith('health:')) return HEALTH_LABEL[r.slice(7) as ProjectHealth] ?? r;
  if (r === 'overdue_tasks') return 'Overdue tasks';
  if (r === 'over_budget') return 'Over budget';
  return r.replace(/_/g, ' ');
}

export default function ProjectsOverviewContent() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/projects/portfolio', { credentials: 'include' }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load portfolio');
        return data as PortfolioData;
      }),
      fetch('/api/projects/analytics', { credentials: 'include' }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load analytics');
        return data as AnalyticsData;
      }),
      fetch('/api/projects/dashboard', { credentials: 'include' }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load dashboard');
        return data as DashboardData;
      }),
    ])
      .then(([p, a, d]) => {
        setPortfolio(p);
        setAnalytics(a);
        setDash(d);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setPortfolio(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function exportWorkbook() {
    setExporting(true);
    try {
      const r = await fetch('/api/projects/export', { credentials: 'include' });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stride-projects-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const empty = !loading && portfolio && portfolio.summary.totalProjects === 0;

  return (
    <div className="space-y-0">
      <ModuleHomeContent domainId="projects" />

      <DashboardPageSection className="mt-8 border-t border-[var(--dash-border)] pt-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--dash-text-strong)]">Portfolio command center</h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              Health, velocity, workload, and at-risk projects across the workspace.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void exportWorkbook()}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3.5 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
            <Link
              href="/dashboard/projects/board"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3.5 py-2 text-sm font-medium text-white hover:opacity-95"
            >
              <LayoutGrid className="h-4 w-4" />
              Board
            </Link>
            <Link
              href="/dashboard/projects/budget"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3.5 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
            >
              <BarChart3 className="h-4 w-4" />
              Budget
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
          <div className="space-y-6">
            <ProjectStatSkeleton count={4} />
            <ProjectSkeleton rows={3} />
          </div>
        ) : empty ? (
          <ProjectEmptyState
            icon={Briefcase}
            title="No projects yet"
            description="Create your first project to unlock portfolio health, velocity charts, and workload insights."
            action={
              <Link
                href="/dashboard/projects/all?new=1"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                New project
              </Link>
            }
          />
        ) : portfolio && analytics && dash ? (
          <div className="space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <Kpi label="Projects" value={String(portfolio.summary.totalProjects)} />
              <Kpi label="Completion" value={`${portfolio.summary.completionPercent}%`} />
              <Kpi label="Open tasks" value={String(dash.summary.openTasks)} />
              <Kpi
                label="Overdue"
                value={String(dash.summary.overdueTasks)}
                warn={dash.summary.overdueTasks > 0}
              />
              <Kpi
                label="Milestones"
                value={`${dash.summary.milestonesDone}/${dash.summary.milestonesTotal}`}
              />
              <Kpi
                label="At risk"
                value={String(portfolio.atRisk.length)}
                warn={portfolio.atRisk.length > 0}
              />
            </div>

            {/* Charts row */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Velocity (8 weeks)" subtitle="Tasks created vs completed">
                <ProjectVelocityChart data={analytics.velocity} />
              </ChartCard>
              <ChartCard title="Task mix" subtitle="By status across the portfolio">
                <ProjectStatusMixChart statusMix={analytics.statusMix} />
              </ChartCard>
              <ChartCard title="Portfolio health" subtitle="Project health distribution">
                <ProjectHealthBars healthCounts={portfolio.healthCounts} />
              </ChartCard>
              <ChartCard title="Workload" subtitle="Open tasks by assignee">
                <ProjectWorkloadChart workload={portfolio.workload} />
              </ChartCard>
            </div>

            {/* At risk + burn + deadlines */}
            <div className="grid gap-4 lg:grid-cols-5">
              <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 lg:col-span-2">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  At-risk projects
                </h3>
                {!portfolio.atRisk.length ? (
                  <p className="text-sm text-[var(--dash-text-muted)]">All projects look healthy.</p>
                ) : (
                  <ul className="space-y-2">
                    {portfolio.atRisk.slice(0, 8).map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="block rounded-lg border border-[var(--dash-border)] px-3 py-2 hover:bg-[var(--dash-hover)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--dash-text-strong)]">
                              {p.projectCode} — {p.name}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${HEALTH_STYLES[p.health]}`}>
                              {HEALTH_LABEL[p.health]}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--dash-text-muted)]">
                            {p.reasons.map(reasonLabel).join(' · ')}
                            {p.overdueTaskCount > 0 ? ` · ${p.overdueTaskCount} overdue` : ''}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 lg:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                    <BarChart3 className="h-4 w-4" />
                    Budget burn
                  </h3>
                  <Link href="/dashboard/projects/budget" className="text-xs text-[var(--brand-primary)] hover:underline">
                    Full report →
                  </Link>
                </div>
                {!dash.burnTop.length ? (
                  <p className="text-sm text-[var(--dash-text-muted)]">No active projects with budget data.</p>
                ) : (
                  <ul className="space-y-3">
                    {dash.burnTop.map((b) => (
                      <li key={b.projectId}>
                        <div className="flex items-center justify-between text-sm">
                          <Link
                            href={`/dashboard/projects/${b.projectId}`}
                            className="font-medium text-[var(--dash-text-strong)] hover:underline"
                          >
                            {b.projectName}
                          </Link>
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
                            className={`h-full rounded-full ${
                              b.utilizationPercent > 100
                                ? 'bg-red-500'
                                : b.utilizationPercent > 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(b.utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                          {fmtMoney(b.totalActual, b.currency)} / {fmtMoney(b.budget.allocated, b.currency)}
                          {b.burnRateMonthly != null
                            ? ` · ${fmtMoney(b.burnRateMonthly, b.currency)}/mo`
                            : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-[var(--stride-coral)]" />
                  Upcoming milestones
                </h3>
                {!portfolio.upcomingMilestones.length ? (
                  <p className="text-sm text-[var(--dash-text-muted)]">No upcoming milestones.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {portfolio.upcomingMilestones.map((m) => (
                      <li
                        key={m.id}
                        className="flex justify-between gap-2 border-b border-[var(--dash-border-subtle)] pb-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--dash-text-strong)]">{m.title}</p>
                          {m.project ? (
                            <Link
                              href={`/dashboard/projects/${m.project.id}`}
                              className="text-xs text-[var(--dash-text-muted)] hover:underline"
                            >
                              {m.project.projectCode}
                            </Link>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs text-[var(--dash-text-muted)]">
                          {m.dueDate ?? '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <ListTodo className="h-4 w-4" />
                    Due in 14 days
                  </h3>
                  <Link href="/dashboard/projects/tasks" className="text-xs text-[var(--brand-primary)] hover:underline">
                    All tasks →
                  </Link>
                </div>
                {!dash.tasksDueSoon.length ? (
                  <p className="text-sm text-[var(--dash-text-muted)]">No upcoming task deadlines.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {dash.tasksDueSoon.map((t) => (
                      <li
                        key={t.id}
                        className="flex justify-between gap-2 border-b border-[var(--dash-border-subtle)] pb-2 last:border-0"
                      >
                        <span className="text-[var(--dash-text-strong)]">{t.title}</span>
                        <span className="shrink-0 text-xs text-[var(--dash-text-muted)]">
                          {t.dueDate ?? '—'}
                          {t.project ? ` · ${t.project.projectCode}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Workload avatars strip */}
            {portfolio.workload.length > 0 ? (
              <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
                <h3 className="mb-3 text-sm font-semibold">Team load</h3>
                <div className="flex flex-wrap gap-3">
                  {portfolio.workload.slice(0, 12).map((w) => (
                    <div
                      key={w.userId}
                      className="flex items-center gap-2 rounded-lg border border-[var(--dash-border-subtle)] px-2.5 py-1.5"
                      title={`${w.openTaskCount} open · ${Math.round(w.estimateHours)}h`}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--stride-coral)] text-[10px] font-semibold text-white">
                        {initials(w.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--dash-text-strong)]">
                          {w.name ?? 'Unknown'}
                        </p>
                        <p className="text-[10px] text-[var(--dash-text-muted)]">
                          {w.openTaskCount} open
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </DashboardPageSection>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
      <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-red-600' : 'text-[var(--dash-text-strong)]'}`}>
        {value}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">{title}</h3>
        {subtitle ? <p className="text-xs text-[var(--dash-text-muted)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
