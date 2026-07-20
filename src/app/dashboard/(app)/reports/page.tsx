'use client';

import Link from 'next/link';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  Briefcase,
  Building2,
  CalendarOff,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  GraduationCap,
  HardHat,
  Landmark,
  Layers,
  Lock,
  PiggyBank,
  Receipt,
  Search,
  Shield,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { ExportButton, type ExportOption } from '@/components/dashboard/ExportButton';
import { apiFetch, useApiResource } from '@/hooks/useApiResource';
import { useDashboardSession } from '@/contexts/dashboard-session';
import {
  REPORT_CATALOG,
  REPORT_CATEGORIES,
  defaultParamValues,
  reportCategoryLabel,
  resolveReportAccess,
  tierLabel,
  type ReportAccess,
  type ReportCategoryId,
  type ReportDefinition,
} from '@/lib/reports-catalog';

type GenericPayload = Record<string, unknown>;

type ReportsSummary = {
  generatedAt: string;
  people: { employees: number; departments: number; newHires30d: number; terminations30d: number };
  credentials: { total: number; expiring30: number; expired: number };
  time: {
    attendanceSummariesMonth: number;
    openAttendanceExceptions: number;
    pendingLeave: number;
    approvedLeaveMonth: number;
  };
  payroll: { runsThisMonth: number; runsTotal: number };
  compliance: { openDisciplinaryCases: number; openGrievances: number; activeOnboarding: number };
  recruitment: {
    activeJobs: number;
    totalApplications: number;
    pendingApplications: number;
    upcomingInterviews: number;
  };
  governance: { essUsers: number; auditEvents30d: number };
  finance: { invoicesOutstanding: number; vendorBillsOutstanding: number };
};

type PreviewView = { key: string; label: string; rows: Array<Record<string, unknown>> };

type PreviewState = {
  title: string;
  endpoint: string;
  metrics: Array<{ label: string; value: string }>;
  views: PreviewView[];
};

const ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Users,
  BadgeCheck,
  CalendarOff,
  Clock3,
  Landmark,
  FileSpreadsheet,
  Briefcase,
  Shield,
  GraduationCap,
  Receipt,
  CircleDollarSign,
  Wallet,
  ClipboardList,
  Boxes,
  HardHat,
  FolderKanban,
  Gauge,
  TrendingUp,
  Truck,
  Building2,
  ScrollText: FileText,
  FileText,
  PiggyBank,
  Stethoscope,
};

function iconFor(name: string): ComponentType<{ className?: string; strokeWidth?: number }> {
  return ICONS[name] ?? FileText;
}

const ROW_VIEWS: Array<{ key: string; label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'byDepartment', label: 'By department' },
  { key: 'byEmployee', label: 'By employee' },
  { key: 'byStatus', label: 'By status' },
  { key: 'byType', label: 'By type' },
  { key: 'byCategory', label: 'By category' },
  { key: 'bySeverity', label: 'By severity' },
  { key: 'byProgram', label: 'By program' },
  { key: 'byJob', label: 'By job' },
  { key: 'byContractType', label: 'By contract' },
  { key: 'rows', label: 'Rows' },
];

const SUMMARY_KEYS = [
  'totalEmployees',
  'totalApplications',
  'totalGross',
  'totalNet',
  'totalHours',
  'totalOvertimeHours',
  'totalCredentials',
  'totalClaims',
  'totalAmount',
  'totalAssets',
  'totalIncidents',
  'totalPrograms',
  'totalEnrolments',
  'completionRate',
  'pending',
  'approved',
  'openDisciplinaryCases',
  'activeJobs',
  'conversionRate',
] as const;

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** Append a download format to an endpoint that may already carry query params. */
function exportOptions(endpoint: string): ExportOption[] {
  const separator = endpoint.includes('?') ? '&' : '?';
  return [
    { format: 'csv', label: 'CSV', href: `${endpoint}${separator}format=csv` },
    { format: 'xlsx', label: 'Excel (.xlsx)', href: `${endpoint}${separator}format=xlsx` },
    { format: 'pdf', label: 'PDF', href: `${endpoint}${separator}format=pdf` },
  ];
}

const inputClass =
  'rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

const ACCESS_BADGE: Record<ReportAccess, { label: string; className: string }> = {
  available: {
    label: 'Ready',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  'coming-soon': {
    label: 'Coming soon',
    className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  upgrade: {
    label: 'Upgrade',
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  enable: {
    label: 'Off',
    className: 'border-[var(--dash-border)] bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]',
  },
};

function ParamControls({
  report,
  values,
  onChange,
}: {
  report: ReportDefinition;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (!report.params?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {report.params.map((param) => {
        if (param.kind === 'range') {
          return (
            <div key={param.fromKey} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={values[param.fromKey] ?? ''}
                onChange={(e) => onChange(param.fromKey, e.target.value)}
                className={inputClass}
                aria-label={`${report.title} ${param.label} from`}
              />
              <span className="text-xs text-[var(--dash-text-muted)]">to</span>
              <input
                type="date"
                value={values[param.toKey] ?? ''}
                onChange={(e) => onChange(param.toKey, e.target.value)}
                className={inputClass}
                aria-label={`${report.title} ${param.label} to`}
              />
            </div>
          );
        }
        return (
          <input
            key={param.key}
            type={param.kind === 'month' ? 'month' : 'date'}
            value={values[param.key] ?? ''}
            onChange={(e) => onChange(param.key, e.target.value)}
            className={inputClass}
            aria-label={`${report.title} ${param.label}`}
          />
        );
      })}
    </div>
  );
}

function ReportCard({
  report,
  access,
  requiredTier,
  values,
  onParamChange,
  onPreview,
}: {
  report: ReportDefinition;
  access: ReportAccess;
  requiredTier: string;
  values: Record<string, string>;
  onParamChange: (key: string, value: string) => void;
  onPreview: () => void;
}) {
  const Icon = iconFor(report.icon);
  const badge = ACCESS_BADGE[access];
  const locked = access === 'upgrade' || access === 'enable';
  const endpoint = report.endpoint ? report.endpoint(values) : '';

  return (
    <section
      className={`dashboard-surface relative flex flex-col gap-3 p-5 shadow-sm transition-shadow hover:shadow-md ${
        locked ? 'opacity-95' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              locked
                ? 'bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]'
                : 'bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300'
            }`}
          >
            {locked ? <Lock className="h-4 w-4" strokeWidth={1.75} /> : <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">{report.title}</h3>
            <p className="text-[11px] font-medium text-[var(--dash-text-muted)]">
              {reportCategoryLabel(report.category)}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-[var(--dash-text-muted)]">{report.description}</p>

      {access === 'available' ? (
        <>
          <ParamControls report={report} values={values} onChange={onParamChange} />
          {report.variants?.length ? (
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              {report.variants.map((variant) => (
                <ExportButton
                  key={variant.type}
                  label={variant.label}
                  options={exportOptions(report.endpoint!(values, variant.type))}
                />
              ))}
            </div>
          ) : (
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onPreview}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-900 transition hover:bg-primary-100 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-primary-200"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <ExportButton options={exportOptions(endpoint)} label="Export" />
            </div>
          )}
        </>
      ) : access === 'coming-soon' ? (
        <div className="mt-auto pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--dash-text-muted)]">
            <Sparkles className="h-3.5 w-3.5" />
            In development — available soon
          </span>
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {access === 'upgrade' ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Lock className="h-3.5 w-3.5" />
                Included in {requiredTier}
              </span>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
              >
                View plans
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--dash-text-muted)]">
                <Lock className="h-3.5 w-3.5" />
                Turned off for this workspace
              </span>
              <Link
                href="/dashboard/admin/company-setup"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
              >
                Enable in Company Setup
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const { modules, deploymentTier } = useDashboardSession();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ReportCategoryId | 'all' | 'featured'>('all');
  const [hideLocked, setHideLocked] = useState(false);
  const [paramState, setParamState] = useState<Record<string, Record<string, string>>>(() => {
    const seed: Record<string, Record<string, string>> = {};
    for (const report of REPORT_CATALOG) {
      if (report.params?.length) seed[report.id] = defaultParamValues(report);
    }
    return seed;
  });

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [activeView, setActiveView] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const summaryQuery = useApiResource<ReportsSummary>(['reports-summary'], '/api/reports/summary');
  const summary = summaryQuery.data;

  const setParam = (reportId: string, key: string, value: string) => {
    setParamState((prev) => ({ ...prev, [reportId]: { ...prev[reportId], [key]: value } }));
  };

  const decorated = useMemo(
    () =>
      REPORT_CATALOG.map((report) => {
        const { access, requiredTier } = resolveReportAccess(report, modules, deploymentTier);
        return { report, access, requiredTier };
      }),
    [modules, deploymentTier],
  );

  const coverage = useMemo(() => {
    let available = 0;
    let comingSoon = 0;
    let upgrade = 0;
    for (const item of decorated) {
      if (item.access === 'available') available += 1;
      else if (item.access === 'coming-soon') comingSoon += 1;
      else if (item.access === 'upgrade') upgrade += 1;
    }
    return { total: decorated.length, available, comingSoon, upgrade };
  }, [decorated]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return decorated.filter(({ report, access }) => {
      if (hideLocked && (access === 'upgrade' || access === 'enable')) return false;
      if (activeCategory === 'featured' && !report.featured) return false;
      if (activeCategory !== 'all' && activeCategory !== 'featured' && report.category !== activeCategory) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        report.title,
        report.description,
        reportCategoryLabel(report.category),
        ...(report.keywords ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [decorated, search, activeCategory, hideLocked]);

  const grouped = useMemo(() => {
    return REPORT_CATEGORIES.map((category) => ({
      category,
      items: filtered.filter(({ report }) => report.category === category.id),
    })).filter((group) => group.items.length > 0);
  }, [filtered]);

  const availableCategories = useMemo(() => {
    const ids = new Set(decorated.map(({ report }) => report.category));
    return REPORT_CATEGORIES.filter((category) => ids.has(category.id));
  }, [decorated]);

  async function openPreview(endpoint: string, title: string) {
    setActiveView(0);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreview({ title, endpoint, metrics: [], views: [] });
    try {
      const data = await apiFetch<GenericPayload>(endpoint);

      const views: PreviewView[] = [];
      for (const view of ROW_VIEWS) {
        const value = data[view.key];
        if (Array.isArray(value) && value.length > 0) {
          views.push({ key: view.key, label: view.label, rows: value as Array<Record<string, unknown>> });
        }
      }

      const metrics: Array<{ label: string; value: string }> = [];
      for (const key of SUMMARY_KEYS) {
        const value = data[key];
        if (value !== undefined && value !== null && typeof value !== 'object') {
          metrics.push({ label: formatLabel(key), value: String(value) });
        }
      }
      for (const [key, value] of Object.entries(data)) {
        if (
          typeof value === 'number' &&
          !SUMMARY_KEYS.includes(key as (typeof SUMMARY_KEYS)[number]) &&
          !key.startsWith('total') &&
          metrics.length < 12
        ) {
          metrics.push({ label: formatLabel(key), value: String(value) });
        }
      }

      setPreview({ title, endpoint, metrics: metrics.slice(0, 12), views });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to build preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  const currentView = preview?.views[activeView];
  const columns = currentView?.rows[0] ? Object.keys(currentView.rows[0]) : [];

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Communications & reports"
        title="Report Center"
        description="Platform-wide reporting across HR, payroll, finance, operations, and compliance — preview live, then export to CSV, Excel, or PDF."
        badges={[
          { label: `${tierLabel(deploymentTier)} plan`, icon: Sparkles },
          { label: `${coverage.available} reports ready` },
        ]}
        actions={
          coverage.upgrade > 0
            ? [{ label: `Unlock ${coverage.upgrade} more`, href: '/pricing', icon: ArrowUpRight, variant: 'secondary' }]
            : undefined
        }
      />

      <DashboardAsyncState
        status={summaryQuery.isLoading ? 'loading' : summaryQuery.isError ? 'error' : 'success'}
        error={summaryQuery.error?.message}
        onRetry={() => void summaryQuery.refetch()}
        loading={<DashboardInlineLoading label="Loading platform snapshot…" />}
      >
        {summary ? (
          <>
            <DashboardStatGrid columns={4}>
              <DashboardStatCard label="Active employees" value={summary.people.employees} tone="primary" />
              <DashboardStatCard
                label="Pending leave"
                value={summary.time.pendingLeave}
                hint={summary.time.approvedLeaveMonth > 0 ? `${summary.time.approvedLeaveMonth} approved this month` : undefined}
                tone="sky"
              />
              <DashboardStatCard
                label="Credentials expiring"
                value={summary.credentials.expiring30}
                hint={summary.credentials.expired > 0 ? `${summary.credentials.expired} already expired` : undefined}
                tone={summary.credentials.expiring30 > 0 ? 'warning' : 'success'}
              />
              <DashboardStatCard
                label="Payroll runs (month)"
                value={summary.payroll.runsThisMonth}
                hint={`${summary.payroll.runsTotal} all time`}
                tone="violet"
              />
            </DashboardStatGrid>

            <DashboardStatGrid columns={4} className="mt-3">
              <DashboardStatCard
                label="Open compliance items"
                value={summary.compliance.openDisciplinaryCases + summary.compliance.openGrievances}
                hint={`${summary.compliance.activeOnboarding} onboarding in progress`}
                tone={summary.compliance.openDisciplinaryCases + summary.compliance.openGrievances > 0 ? 'warning' : 'success'}
              />
              <DashboardStatCard
                label="Attendance exceptions"
                value={summary.time.openAttendanceExceptions}
                hint={`${summary.time.attendanceSummariesMonth} day summaries this month`}
                tone={summary.time.openAttendanceExceptions > 0 ? 'warning' : 'primary'}
              />
              <DashboardStatCard
                label="Recruitment pipeline"
                value={summary.recruitment.pendingApplications}
                hint={`${summary.recruitment.activeJobs} active jobs · ${summary.recruitment.upcomingInterviews} interviews`}
                tone="primary"
              />
              <DashboardStatCard
                label="ESS portal users"
                value={summary.governance.essUsers}
                hint={`${summary.governance.auditEvents30d} audit events (30d)`}
                tone="sky"
              />
            </DashboardStatGrid>
          </>
        ) : null}
      </DashboardAsyncState>

      {/* Toolbar: search + category filter + locked toggle */}
      <div className="dashboard-surface mt-6 flex flex-col gap-3 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports (e.g. payroll, expiry, incident)…"
              className={`${inputClass} w-full pl-9`}
              aria-label="Search reports"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--dash-text-muted)]">
              {filtered.length} of {coverage.total} reports
            </span>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--dash-text-body)]">
              <input
                type="checkbox"
                checked={hideLocked}
                onChange={(e) => setHideLocked(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[var(--dash-border)] text-primary-600 focus:ring-primary-500/30"
              />
              Hide locked
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} icon={Layers}>
            All
          </FilterChip>
          <FilterChip
            active={activeCategory === 'featured'}
            onClick={() => setActiveCategory('featured')}
            icon={Sparkles}
          >
            Featured
          </FilterChip>
          {availableCategories.map((category) => (
            <FilterChip
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="mt-6">
          <DashboardTableEmpty
            title="No reports match your filters"
            description="Try a different search term, clear the category filter, or show locked reports."
          />
        </div>
      ) : (
        grouped.map(({ category, items }) => (
          <DashboardPageSection
            key={category.id}
            title={category.label}
            description={category.description}
            className="mt-6"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map(({ report, access, requiredTier }) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  access={access}
                  requiredTier={tierLabel(requiredTier)}
                  values={paramState[report.id] ?? {}}
                  onParamChange={(key, value) => setParam(report.id, key, value)}
                  onPreview={() =>
                    openPreview(
                      report.endpoint ? report.endpoint(paramState[report.id] ?? {}) : '',
                      report.title,
                    )
                  }
                />
              ))}
            </div>
          </DashboardPageSection>
        ))
      )}

      <DashboardModal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.title ?? 'Report preview'}
        description="Live preview — export for the full dataset."
        icon={<Eye className="h-4 w-4" />}
        size="xl"
        footer={preview ? <ExportButton options={exportOptions(preview.endpoint)} label="Export" /> : null}
      >
        {previewLoading ? (
          <DashboardInlineLoading label="Building preview…" />
        ) : previewError ? (
          <DashboardTableEmpty title="Preview failed" description={previewError} />
        ) : preview ? (
          <div className="space-y-4">
            {preview.metrics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {preview.metrics.map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2.5 py-1 text-xs text-[var(--dash-text-body)]"
                  >
                    <span className="font-semibold text-[var(--dash-text-strong)]">{item.value}</span>
                    <span className="text-[var(--dash-text-muted)]">{item.label}</span>
                  </span>
                ))}
              </div>
            ) : null}

            {preview.views.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {preview.views.map((view, index) => (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => setActiveView(index)}
                    className={
                      index === activeView
                        ? 'rounded-full bg-primary-900 px-3 py-1.5 text-xs font-semibold text-white'
                        : 'rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text-body)] hover:bg-[var(--dash-hover)]'
                    }
                  >
                    {view.label}
                    <span className="ml-1.5 text-[var(--dash-text-muted)]">{view.rows.length}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {currentView && columns.length > 0 ? (
              <DashboardTableViewport minWidth={Math.max(640, columns.length * 130)}>
                <DashboardTable>
                  <thead>
                    <tr>
                      {columns.map((key) => (
                        <th key={key}>{formatLabel(key)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentView.rows.slice(0, 200).map((row, i) => (
                      <tr key={`${currentView.key}-${i}`}>
                        {columns.map((key) => (
                          <td key={key} className="tabular-nums">
                            {formatCell(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
                {currentView.rows.length > 200 ? (
                  <DashboardTableEmpty
                    title="Preview truncated"
                    description={`Showing first 200 of ${currentView.rows.length} rows. Export for the full dataset.`}
                  />
                ) : null}
              </DashboardTableViewport>
            ) : (
              <DashboardTableEmpty
                title="No tabular data"
                description="This report has no row-level breakdown to preview. Export to view its summary."
              />
            )}
          </div>
        ) : null}
      </DashboardModal>
    </DashboardPage>
  );
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'inline-flex items-center gap-1.5 rounded-full bg-primary-900 px-3 py-1.5 text-xs font-semibold text-white'
          : 'inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text-body)] transition hover:bg-[var(--dash-hover)]'
      }
    >
      {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.75} /> : null}
      {children}
    </button>
  );
}
