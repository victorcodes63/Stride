'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatGrid, DashboardMetricCard } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardAsyncState,
  DashboardEmptyState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { useApiResource } from '@/hooks/useApiResource';
import { STRIDE_DASHBOARD_SWATCHES } from '@/lib/platform-swatches';
import type { UserSummary } from '@/types/dashboard';

type StatusDatum = { status: string; label: string; count: number };
type TimeDatum = { month: string; label: string; count: number };
type TopJobDatum = { jobId: string; title: string; company: string; count: number };

type ReportsOverview = {
  recruitmentAnalytics: {
    totalApplications: number;
    activeJobs: number;
    totalJobs: number;
    totalInterviews: number;
    scheduledInterviews: number;
    hired: number;
    conversionRate: number;
    requisitionApprovalsPending: number;
    offerApprovalsPending: number;
    hiresConverted: number;
    hireConversionRate: number;
  };
  applicationsByStatus: StatusDatum[];
  applicationsOverTime: TimeDatum[];
  topJobs: TopJobDatum[];
  interviewsByStatus: StatusDatum[];
  operations: {
    employees: number;
    departments: number;
    credentials: number;
    expiringCredentials: number;
    attendanceRecordsThisMonth: number;
    payrollRunsThisMonth: number;
    payrollRunsTotal: number;
  };
  leave: { pending: number; approved: number };
  finance: { invoicesOutstanding: number; vendors: number; vendorBillsOutstanding: number };
  governance: { activeUsers: number; essUsers: number; auditEvents: number };
};

const APPLICATION_STATUS_COLOR: Record<string, string> = {
  pending: STRIDE_DASHBOARD_SWATCHES.amber.accent,
  reviewed: STRIDE_DASHBOARD_SWATCHES.sky.accent,
  shortlisted: STRIDE_DASHBOARD_SWATCHES.violet.accent,
  rejected: STRIDE_DASHBOARD_SWATCHES.rose.accent,
  hired: STRIDE_DASHBOARD_SWATCHES.emerald.accent,
};

const INTERVIEW_STATUS_COLOR: Record<string, string> = {
  scheduled: STRIDE_DASHBOARD_SWATCHES.sky.accent,
  completed: STRIDE_DASHBOARD_SWATCHES.emerald.accent,
  cancelled: STRIDE_DASHBOARD_SWATCHES.rose.accent,
};

const AXIS_TICK = { fill: 'var(--dash-text-muted)', fontSize: 12 } as const;
const GRID_STROKE = 'var(--dash-border)';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = label ?? (payload[0]?.payload?.label as string | undefined) ?? payload[0]?.name;
  return (
    <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-xs shadow-lg">
      {heading ? <p className="mb-1 font-semibold text-[var(--dash-text-strong)]">{heading}</p> : null}
      {payload.map((entry, index) => (
        <p key={index} className="flex items-center gap-1.5 text-[var(--dash-text-body)]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? 'var(--brand-primary)' }}
          />
          <span className="tabular-nums font-medium text-[var(--dash-text-strong)]">{entry.value}</span>
          <span className="text-[var(--dash-text-muted)]">{entry.name}</span>
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  icon: typeof FileCheck;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-surface min-w-0 p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
        <Icon className="h-4 w-4 text-primary-600" strokeWidth={1.75} />
        {title}
      </h2>
      {isEmpty ? (
        <div className="flex h-[240px] items-center justify-center">
          <p className="text-sm text-[var(--dash-text-muted)]">{emptyLabel}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function ModuleSnapshot({ overview }: { overview: ReportsOverview }) {
  const blocks: Array<{ title: string; rows: Array<{ label: string; value: number; warn?: boolean }> }> = [
    {
      title: 'People & compliance',
      rows: [
        { label: 'Employees', value: overview.operations.employees },
        { label: 'Departments', value: overview.operations.departments },
        { label: 'Credentials', value: overview.operations.credentials },
        { label: 'Expiring (30d)', value: overview.operations.expiringCredentials, warn: true },
      ],
    },
    {
      title: 'Payroll & attendance',
      rows: [
        { label: 'Payroll runs (month)', value: overview.operations.payrollRunsThisMonth },
        { label: 'Payroll runs (total)', value: overview.operations.payrollRunsTotal },
        { label: 'Attendance (month)', value: overview.operations.attendanceRecordsThisMonth },
        { label: 'Leave pending', value: overview.leave.pending, warn: true },
      ],
    },
    {
      title: 'Finance',
      rows: [
        { label: 'Open invoices', value: overview.finance.invoicesOutstanding, warn: true },
        { label: 'Vendors', value: overview.finance.vendors },
        { label: 'Open vendor bills', value: overview.finance.vendorBillsOutstanding, warn: true },
        { label: 'Leave approved', value: overview.leave.approved },
      ],
    },
    {
      title: 'Governance',
      rows: [
        { label: 'Active staff users', value: overview.governance.activeUsers },
        { label: 'ESS users', value: overview.governance.essUsers },
        { label: 'Audit events', value: overview.governance.auditEvents },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {blocks.map((block) => (
        <div key={block.title} className="dashboard-surface p-4 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
            {block.title}
          </p>
          <dl className="space-y-1">
            {block.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2">
                <dt className="text-sm text-[var(--dash-text-body)]">{row.label}</dt>
                <dd
                  className={`text-sm font-semibold tabular-nums ${
                    row.warn && row.value > 0 ? 'text-[var(--swatch-amber-fg)]' : 'text-[var(--dash-text-strong)]'
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export default function DashboardAnalyticsPage() {
  const router = useRouter();
  const [access, setAccess] = useState<'unknown' | 'allowed' | 'denied'>('unknown');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me: UserSummary | null) => {
        if (cancelled) return;
        if (!me?.canViewSystemAnalytics) {
          setAccess('denied');
          router.replace('/dashboard');
          return;
        }
        setAccess('allowed');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const query = useApiResource<ReportsOverview>(['reports-overview'], '/api/reports/overview', {
    enabled: access === 'allowed',
  });

  if (access === 'unknown') {
    return (
      <div className="flex w-full min-w-0 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-4 py-16 text-center">
        <p className="text-sm text-[var(--dash-text-muted)]">Redirecting…</p>
        <Link href="/dashboard" className="text-sm font-medium text-primary-700 underline">
          Back to overview
        </Link>
      </div>
    );
  }

  const overview = query.data;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Executive analytics"
        title="Analytics"
        description="System-wide recruitment and operations performance, aggregated in real time."
      />

      <DashboardAsyncState
        status={query.isLoading ? 'loading' : query.isError ? 'error' : 'success'}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        {overview ? (
          <>
            <DashboardStatGrid columns={6}>
              <DashboardMetricCard
                label="Applications"
                value={overview.recruitmentAnalytics.totalApplications}
                icon={FileCheck}
                tone="primary"
              />
              <DashboardMetricCard
                label="Conversion rate"
                value={`${overview.recruitmentAnalytics.conversionRate}%`}
                hint={`${overview.recruitmentAnalytics.hired} hired`}
                icon={TrendingUp}
                tone="emerald"
              />
              <DashboardMetricCard
                label="Hires converted"
                value={overview.recruitmentAnalytics.hiresConverted}
                hint={`${overview.recruitmentAnalytics.hireConversionRate}% of applications`}
                icon={CheckCircle2}
                tone="emerald"
              />
              <DashboardMetricCard
                label="Approvals pending"
                value={
                  overview.recruitmentAnalytics.requisitionApprovalsPending +
                  overview.recruitmentAnalytics.offerApprovalsPending
                }
                hint={`${overview.recruitmentAnalytics.requisitionApprovalsPending} req · ${overview.recruitmentAnalytics.offerApprovalsPending} offer`}
                icon={ClipboardCheck}
                tone="amber"
              />
              <DashboardMetricCard
                label="Active jobs"
                value={overview.recruitmentAnalytics.activeJobs}
                hint={`${overview.recruitmentAnalytics.totalJobs} total`}
                icon={Briefcase}
                tone="violet"
              />
              <DashboardMetricCard
                label="Interviews"
                value={overview.recruitmentAnalytics.totalInterviews}
                hint={`${overview.recruitmentAnalytics.scheduledInterviews} scheduled`}
                icon={CalendarCheck}
                tone="violet"
              />
            </DashboardStatGrid>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ChartCard
                title="Applications by status"
                icon={FileCheck}
                isEmpty={overview.recruitmentAnalytics.totalApplications === 0}
                emptyLabel="No applications yet."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={overview.applicationsByStatus} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--dash-hover)' }} />
                    <Bar dataKey="count" name="Applications" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {overview.applicationsByStatus.map((entry) => (
                        <Cell key={entry.status} fill={APPLICATION_STATUS_COLOR[entry.status] ?? 'var(--brand-primary)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Applications over time (12 months)"
                icon={TrendingUp}
                isEmpty={overview.applicationsOverTime.every((m) => m.count === 0)}
                emptyLabel="No application activity in this period."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={overview.applicationsOverTime} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appsOverTime" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={STRIDE_DASHBOARD_SWATCHES.sky.accent} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={STRIDE_DASHBOARD_SWATCHES.sky.accent} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID_STROKE }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Applications"
                      stroke={STRIDE_DASHBOARD_SWATCHES.sky.accent}
                      strokeWidth={2}
                      fill="url(#appsOverTime)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Top jobs by applications"
                icon={Briefcase}
                isEmpty={overview.topJobs.length === 0}
                emptyLabel="No applications yet."
              >
                <ResponsiveContainer width="100%" height={Math.max(240, overview.topJobs.length * 34)}>
                  <BarChart
                    data={overview.topJobs}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                    <YAxis
                      type="category"
                      dataKey="title"
                      width={140}
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STROKE }}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--dash-hover)' }} />
                    <Bar
                      dataKey="count"
                      name="Applications"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={26}
                      fill={STRIDE_DASHBOARD_SWATCHES.violet.accent}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Interviews by status"
                icon={CalendarCheck}
                isEmpty={overview.recruitmentAnalytics.totalInterviews === 0}
                emptyLabel="No interviews scheduled yet."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={overview.interviewsByStatus.filter((d) => d.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {overview.interviewsByStatus
                        .filter((d) => d.count > 0)
                        .map((entry) => (
                          <Cell key={entry.status} fill={INTERVIEW_STATUS_COLOR[entry.status] ?? 'var(--brand-primary)'} />
                        ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      formatter={(value) => <span className="text-xs text-[var(--dash-text-body)]">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <DashboardPageSection title="Operations snapshot" className="mt-2">
              <ModuleSnapshot overview={overview} />
            </DashboardPageSection>
          </>
        ) : (
          <DashboardEmptyState title="No analytics data" description="There is nothing to report yet." />
        )}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
