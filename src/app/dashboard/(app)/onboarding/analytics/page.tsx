'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock,
  Layers,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatGrid, DashboardMetricCard } from '@/components/dashboard/DashboardStatGrid';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import {
  HorizontalBarChart,
  StatusDonut,
  ThroughputChart,
  type ChartTone,
  type HBarDatum,
} from '@/components/onboarding/AnalyticsCharts';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';

const WORKFLOW_TYPES = ['ONBOARDING', 'OFFBOARDING'] as const;
type WorkflowType = (typeof WORKFLOW_TYPES)[number];

type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE';

type AnalyticsResponse = {
  type: WorkflowType;
  summary: {
    activeWorkflows: number;
    completedWorkflows: { last90d: number; allTime: number };
    cancelledWorkflows: number;
    avgCompletionDays: number;
    onTimeRate: number;
    totalOverdueTasks: number;
  };
  statusBreakdown: Array<{ status: TaskStatus; count: number }>;
  bottlenecks: Array<{
    category: string;
    total: number;
    completed: number;
    overdue: number;
    avgOpenDays: number;
  }>;
  overdueByOwner: Array<{ owner: string; count: number }>;
  byDepartment: Array<{ department: string; workflows: number; avgProgress: number }>;
  throughput: Array<{ label: string; key: string; started: number; completed: number }>;
};

const STATUS_META: Record<TaskStatus, { label: string; tone: ChartTone }> = {
  COMPLETED: { label: 'Completed', tone: 'primary' },
  IN_PROGRESS: { label: 'In progress', tone: 'primarySoft' },
  PENDING: { label: 'Pending', tone: 'neutral' },
  SKIPPED: { label: 'Skipped', tone: 'neutral' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
};

async function readAnalyticsResponse(response: Response): Promise<AnalyticsResponse> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not load analytics.');
  }
  return data as AnalyticsResponse;
}

export default function OnboardingAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-neutral-500">Loading analytics…</div>
      }
    >
      <AnalyticsPageContent />
    </Suspense>
  );
}

function AnalyticsPageContent() {
  const { tab: type, setTab: setType } = useDashboardTabParam('type', WORKFLOW_TYPES, 'ONBOARDING');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/onboarding/analytics?type=${type}`)
      .then((r) => readAnalyticsResponse(r))
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load analytics.');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, reloadKey]);

  const status = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (!data) return 'empty' as const;
    return 'success' as const;
  }, [data, error, loading]);

  const statusDonut = useMemo(() => {
    if (!data) return [];
    return data.statusBreakdown.map((s) => ({
      label: STATUS_META[s.status].label,
      value: s.count,
      tone: STATUS_META[s.status].tone,
    }));
  }, [data]);

  const overdueBars: HBarDatum[] = useMemo(() => {
    if (!data) return [];
    return data.overdueByOwner
      .slice(0, 8)
      .map((o) => ({ label: o.owner, value: o.count, tone: 'danger' as const }));
  }, [data]);

  const isOnboarding = type === 'ONBOARDING';
  const noun = isOnboarding ? 'onboarding' : 'offboarding';

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Onboarding analytics"
        description={`Operational health of ${noun} workflows — throughput, bottlenecks, and on-time delivery.`}
        footer={
          <DashboardTabs
            embedded
            value={type}
            onChange={(next) => setType(next as WorkflowType)}
            items={[
              { value: 'ONBOARDING', label: 'Onboarding' },
              { value: 'OFFBOARDING', label: 'Offboarding' },
            ]}
          />
        }
      />

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={() => setReloadKey((k) => k + 1)}
        empty={
          <DashboardTableEmpty
            icon={<Activity className="h-8 w-8 text-neutral-300" aria-hidden />}
            title="No analytics yet"
            description={`Start ${noun} workflows to see performance metrics here.`}
          />
        }
      >
        {data ? (
          <div className="space-y-6">
            <DashboardStatGrid columns={6}>
              <DashboardMetricCard
                label="Active"
                value={data.summary.activeWorkflows}
                hint="In progress"
                icon={Activity}
                tone="primary"
              />
              <DashboardMetricCard
                label="Completed (90d)"
                value={data.summary.completedWorkflows.last90d}
                hint={`${data.summary.completedWorkflows.allTime} all-time`}
                icon={CheckCircle2}
                tone="emerald"
              />
              <DashboardMetricCard
                label="Avg time to complete"
                value={data.summary.avgCompletionDays > 0 ? `${data.summary.avgCompletionDays}d` : '—'}
                hint="Start → complete"
                icon={CalendarClock}
                tone="violet"
              />
              <DashboardMetricCard
                label="On-time rate"
                value={`${data.summary.onTimeRate}%`}
                hint="Tasks done by due date"
                icon={Clock}
                tone={data.summary.onTimeRate >= 80 ? 'emerald' : 'amber'}
              />
              <DashboardMetricCard
                label="Overdue tasks"
                value={data.summary.totalOverdueTasks}
                hint="Needs attention"
                icon={TriangleAlert}
                tone={data.summary.totalOverdueTasks > 0 ? 'amber' : 'emerald'}
              />
              <DashboardMetricCard
                label="Cancelled"
                value={data.summary.cancelledWorkflows}
                hint="All-time"
                icon={Layers}
                tone="primary"
              />
            </DashboardStatGrid>

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardPageSection title="Tasks by status" className="dashboard-surface p-4 shadow-sm sm:p-5">
                <StatusDonut segments={statusDonut} />
              </DashboardPageSection>

              <DashboardPageSection
                title="Monthly throughput"
                description="Workflows started vs completed (last 6 months)"
                className="dashboard-surface p-4 shadow-sm sm:p-5"
              >
                <ThroughputChart data={data.throughput} />
              </DashboardPageSection>
            </div>

            <DashboardPageSection
              title="Bottleneck phases"
              description="Which stage slows workflows down — sorted by overdue, then time open."
            >
              <DashboardTableCard>
                {data.bottlenecks.length === 0 ? (
                  <DashboardTableEmpty
                    icon={<Layers className="h-8 w-8 text-neutral-300" aria-hidden />}
                    title="No task categories yet"
                    description="Tasks with categories will surface bottleneck phases here."
                  />
                ) : (
                  <DashboardTableViewport minWidth={720}>
                    <DashboardTable>
                      <thead className="bg-neutral-50 text-left text-neutral-600">
                        <tr>
                          <th className="px-4 py-3">Phase</th>
                          <th className="col-center px-4 py-3">Tasks</th>
                          <th className="col-center px-4 py-3">Completed</th>
                          <th className="col-center px-4 py-3">Overdue</th>
                          <th className="col-center px-4 py-3">Avg open (days)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bottlenecks.map((row) => {
                          const completionPct =
                            row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                          return (
                            <tr key={row.category} className="border-t">
                              <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                                {row.category}
                              </td>
                              <td className="col-center px-4 py-3 tabular-nums">{row.total}</td>
                              <td className="col-center px-4 py-3">
                                <span
                                  className={dashStatusChip(
                                    completionPct >= 80 ? 'success' : completionPct >= 40 ? 'info' : 'neutral',
                                  )}
                                >
                                  {row.completed} · {completionPct}%
                                </span>
                              </td>
                              <td className="col-center px-4 py-3">
                                <span className={dashStatusChip(row.overdue > 0 ? 'danger' : 'neutral')}>
                                  {row.overdue}
                                </span>
                              </td>
                              <td className="col-center px-4 py-3 tabular-nums">
                                {row.avgOpenDays > 0 ? row.avgOpenDays : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </DashboardTable>
                  </DashboardTableViewport>
                )}
              </DashboardTableCard>
            </DashboardPageSection>

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardPageSection
                title="Overdue by owner"
                description="Where overdue tasks are concentrated"
                className="dashboard-surface p-4 shadow-sm sm:p-5"
              >
                <HorizontalBarChart data={overdueBars} emptyLabel="No overdue tasks — all on track" />
              </DashboardPageSection>

              <DashboardPageSection title="By department" className="dashboard-surface p-4 shadow-sm sm:p-5">
                {data.byDepartment.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--dash-text-muted)]">
                    No department data yet
                  </p>
                ) : (
                  <DashboardTableViewport minWidth={420}>
                    <DashboardTable>
                      <thead className="bg-neutral-50 text-left text-neutral-600">
                        <tr>
                          <th className="px-4 py-3">Department</th>
                          <th className="col-center px-4 py-3">Workflows</th>
                          <th className="px-4 py-3">Avg progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byDepartment.map((row) => (
                          <tr key={row.department} className="border-t">
                            <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                              {row.department}
                            </td>
                            <td className="col-center px-4 py-3 tabular-nums">{row.workflows}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 flex-1 overflow-hidden rounded-full"
                                  style={{ backgroundColor: 'var(--dash-surface-muted)' }}
                                >
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${row.avgProgress}%`,
                                      backgroundColor: 'var(--swatch-coral-accent)',
                                    }}
                                  />
                                </div>
                                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--dash-text-strong)]">
                                  {row.avgProgress}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DashboardTable>
                  </DashboardTableViewport>
                )}
              </DashboardPageSection>
            </div>
          </div>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
