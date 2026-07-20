'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Loader2,
  PlayCircle,
  Plus,
  Scale,
  Square,
  Target,
  Users,
  X,
} from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableHead,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { WorkflowProgressRing } from '@/components/onboarding/WorkflowProgressRing';
import {
  NineBoxMatrix,
  RatingDistributionChart,
  ScoreBar,
  StatTile,
  type NineBoxCellData,
  type NineBoxSelection,
} from '@/components/performance';
import { StrideSelect } from '@/components/ui/stride-select';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import {
  DASHBOARD_FORM_FIELD_CLASS,
  DASHBOARD_FORM_INPUT_CLASS,
  DASHBOARD_FORM_LABEL_CLASS,
  DASHBOARD_INLINE_FORM_CLASS,
} from '@/lib/dashboard-layout';

type Cycle = {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  reviewCount: number;
};

type ReviewRow = {
  id: string;
  employeeName: string;
  employeeNumber: string | null;
  departmentName: string | null;
  status: string;
  overallSelfRating: number | null;
  overallManagerRating: number | null;
  finalResultsScore: number | null;
  finalCompetenciesScore: number | null;
  finalBlendedScore: number | null;
};

type Analytics = {
  distribution: Array<{ label: string; count: number }>;
  nineBox: NineBoxCellData[];
};

type SortKey = 'employee' | 'department' | 'status' | 'self' | 'manager' | 'final';
type SortDir = 'asc' | 'desc';

function statusTone(status: string): DashStatusTone {
  if (status === 'completed') return 'success';
  if (status === 'calibration_pending') return 'warning';
  if (status === 'manager_in_progress' || status === 'manager_submitted') return 'warning';
  if (status === 'self_submitted' || status === 'self_in_progress') return 'info';
  return 'neutral';
}

function band(score: number | null): 'low' | 'mid' | 'high' | null {
  if (score == null) return null;
  if (score < 2.5) return 'low';
  if (score < 3.5) return 'mid';
  return 'high';
}

const CYCLE_STAGES = ['Draft', 'Active', 'Calibration', 'Closed'] as const;

function CycleStepper({ status, hasCalibration }: { status: string; hasCalibration: boolean }) {
  const current =
    status === 'closed' ? 3 : status === 'active' ? (hasCalibration ? 2 : 1) : 0;
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {CYCLE_STAGES.map((stage, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <li key={stage} className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: active
                  ? 'color-mix(in srgb, var(--swatch-coral-accent) 16%, var(--dash-surface-solid))'
                  : done
                    ? 'color-mix(in srgb, var(--swatch-emerald-accent) 14%, var(--dash-surface-solid))'
                    : 'var(--dash-surface-muted)',
                color: active
                  ? 'var(--swatch-coral-accent)'
                  : done
                    ? 'var(--swatch-emerald-accent)'
                    : 'var(--dash-text-muted)',
              }}
            >
              {done ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : null}
              {stage}
            </span>
            {idx < CYCLE_STAGES.length - 1 ? (
              <span className="h-px w-4 bg-[var(--dash-border)]" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function SortHead({
  label,
  sortKey,
  sort,
  setSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  setSort: (s: { key: SortKey; dir: SortDir }) => void;
  align?: 'left' | 'right';
}) {
  const activeSort = sort.key === sortKey;
  return (
    <DashboardTableHead>
      <button
        type="button"
        onClick={() =>
          setSort({ key: sortKey, dir: activeSort && sort.dir === 'asc' ? 'desc' : 'asc' })
        }
        className={`inline-flex items-center gap-1 hover:text-[var(--dash-text-strong)] ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${activeSort ? 'text-[var(--dash-text-strong)]' : ''}`}
      >
        {label}
        {activeSort ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : null}
      </button>
    </DashboardTableHead>
  );
}

export function PerformanceDashboardContent() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nineBoxFilter, setNineBoxFilter] = useState<NineBoxSelection | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'employee', dir: 'asc' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: 'H1 2026 Performance Review',
    periodStart: '2026-01-01',
    periodEnd: '2026-06-30',
    description: 'Mid-year goals and competency review',
  });
  const [goalTemplates, setGoalTemplates] = useState([
    { title: 'Deliver role KPIs on time', weightPercent: 50 },
    { title: 'Complete compliance and training requirements', weightPercent: 50 },
  ]);
  const [ratingDimensions, setRatingDimensions] = useState([
    'Quality of work',
    'Team collaboration',
    'Goal achievement',
    'Communication',
  ]);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? cycles[0] ?? null;

  const loadCycles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/cycles', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load cycles');
      setCycles(data.cycles ?? []);
      if (!selectedCycleId && data.cycles?.[0]?.id) {
        setSelectedCycleId(data.cycles[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedCycleId]);

  const loadReviews = useCallback(async (cycleId: string) => {
    const res = await fetch(`/api/performance/reviews?cycleId=${cycleId}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load reviews');
    setReviews(data.reviews ?? []);
    setStatusCounts(data.statusCounts ?? {});
    setAnalytics(data.analytics ?? null);
  }, []);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    if (selectedCycle?.id) void loadReviews(selectedCycle.id).catch(() => null);
    setNineBoxFilter(null);
  }, [selectedCycle?.id, loadReviews]);

  useEffect(() => {
    if (!selectedCycle?.id || selectedCycle.status !== 'draft') return;
    void fetch(`/api/performance/cycles/${selectedCycle.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.cycle?.goalTemplates?.length) setGoalTemplates(data.cycle.goalTemplates);
        if (data.cycle?.ratingDimensions?.length) setRatingDimensions(data.cycle.ratingDimensions);
      })
      .catch(() => null);
  }, [selectedCycle?.id, selectedCycle?.status]);

  async function saveCycleTemplates() {
    if (!selectedCycle || selectedCycle.status !== 'draft') return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance/cycles/${selectedCycle.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalTemplates, ratingDimensions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of reviews) if (r.departmentName) set.add(r.departmentName);
    return Array.from(set).sort();
  }, [reviews]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of reviews) set.add(r.status);
    return Array.from(set).sort();
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = reviews.filter((r) => {
      if (departmentFilter && r.departmentName !== departmentFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (nineBoxFilter) {
        const results = band(r.finalResultsScore ?? r.overallManagerRating);
        const comp = band(r.finalCompetenciesScore ?? r.overallManagerRating);
        if (results !== nineBoxFilter.resultsBand || comp !== nineBoxFilter.competencyBand) return false;
      }
      if (!q) return true;
      return (
        r.employeeName.toLowerCase().includes(q) ||
        (r.employeeNumber ?? '').toLowerCase().includes(q) ||
        (r.departmentName ?? '').toLowerCase().includes(q)
      );
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const num = (v: number | null) => (v == null ? -1 : v);
    rows = [...rows].sort((a, b) => {
      switch (sort.key) {
        case 'department':
          return dir * (a.departmentName ?? '').localeCompare(b.departmentName ?? '');
        case 'status':
          return dir * a.status.localeCompare(b.status);
        case 'self':
          return dir * (num(a.overallSelfRating) - num(b.overallSelfRating));
        case 'manager':
          return dir * (num(a.overallManagerRating) - num(b.overallManagerRating));
        case 'final':
          return dir * (num(a.finalBlendedScore) - num(b.finalBlendedScore));
        default:
          return dir * a.employeeName.localeCompare(b.employeeName);
      }
    });
    return rows;
  }, [reviews, search, departmentFilter, statusFilter, nineBoxFilter, sort]);

  async function createCycle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/cycles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Create failed');
      setCreateOpen(false);
      await loadCycles();
      setSelectedCycleId(data.cycle.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function activateCycle() {
    if (!selectedCycle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance/cycles/${selectedCycle.id}/activate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Activate failed');
      await loadCycles();
      await loadReviews(selectedCycle.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activate failed');
    } finally {
      setBusy(false);
    }
  }

  async function closeCycle() {
    if (!selectedCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/performance/cycles/${selectedCycle.id}/close`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Close failed');
      await loadCycles();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setBusy(false);
    }
  }

  const total = selectedCycle?.reviewCount ?? reviews.length;
  const completed = statusCounts.completed ?? 0;
  const selfSubmitted = (statusCounts.self_submitted ?? 0) + (statusCounts.manager_in_progress ?? 0) +
    (statusCounts.manager_submitted ?? 0) + (statusCounts.calibration_pending ?? 0) + completed;
  const calibration = statusCounts.calibration_pending ?? 0;
  const notStarted = statusCounts.not_started ?? 0;
  const hasCalibration = calibration > 0 || completed > 0;
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Performance management"
        title="Balanced Scorecard"
        description="Review cycles with BSC scoring and 9-box calibration."
        badges={[
          selectedCycle
            ? { label: `${selectedCycle.name} · ${selectedCycle.status}`, icon: Clock }
            : { label: 'No cycle selected', icon: Clock },
          { label: 'BSC method', icon: Scale },
        ]}
        actions={[
          { label: 'Job descriptions', href: '/dashboard/performance/jds', icon: FileText, variant: 'secondary' },
          { label: 'BSC scorecards', href: '/dashboard/performance/scorecards', icon: Target, variant: 'secondary' },
        ]}
      />

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Cycle command bar */}
      <section className="dashboard-surface mt-4 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {total > 0 ? (
              <div className="flex items-center gap-3">
                <WorkflowProgressRing value={completed} total={total} size={56} tone="primary" />
                <div className="text-xs leading-tight text-[var(--dash-text-muted)]">
                  <div className="font-semibold text-[var(--dash-text-strong)]">
                    {completed}/{total} finalized
                  </div>
                  <div>reviews complete</div>
                </div>
              </div>
            ) : null}
            <CycleStepper status={selectedCycle?.status ?? 'draft'} hasCalibration={hasCalibration} />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block text-[var(--dash-text-muted)]">Cycle</span>
              <StrideSelect
                value={selectedCycle?.id ?? ''}
                onChange={(value) => setSelectedCycleId(value)}
                options={cycles.map((c) => ({ value: c.id, label: `${c.name} (${c.status})` }))}
                ariaLabel="Cycle"
                className="min-w-[220px]"
              />
            </label>
            <button
              type="button"
              className="btn-secondary inline-flex h-10 items-center gap-2 px-3"
              onClick={() => setCreateOpen((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              New cycle
            </button>
            {selectedCycle?.status === 'draft' ? (
              <button
                type="button"
                disabled={busy}
                className="btn-primary inline-flex h-10 items-center gap-2 px-4 disabled:opacity-50"
                onClick={() => void activateCycle()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Activate cycle
              </button>
            ) : null}
            {selectedCycle?.status === 'active' ? (
              <button
                type="button"
                disabled={busy}
                className="btn-secondary inline-flex h-10 items-center gap-2 px-3 disabled:opacity-50"
                onClick={() => void closeCycle()}
              >
                <Square className="h-4 w-4" />
                Close cycle
              </button>
            ) : null}
            {selectedCycle ? (
              <a
                href={`/api/performance/cycles/${selectedCycle.id}/export`}
                className="btn-secondary inline-flex h-10 items-center gap-2 px-3"
                download
              >
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {createOpen ? (
        <div className={`mt-4 grid gap-4 md:grid-cols-2 ${DASHBOARD_INLINE_FORM_CLASS}`}>
          <label className={`md:col-span-2 ${DASHBOARD_FORM_FIELD_CLASS}`}>
            <span className={DASHBOARD_FORM_LABEL_CLASS}>Name</span>
            <input
              className={DASHBOARD_FORM_INPUT_CLASS}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className={DASHBOARD_FORM_FIELD_CLASS}>
            <span className={DASHBOARD_FORM_LABEL_CLASS}>Period start</span>
            <input
              type="date"
              className={DASHBOARD_FORM_INPUT_CLASS}
              value={form.periodStart}
              onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
            />
          </label>
          <label className={DASHBOARD_FORM_FIELD_CLASS}>
            <span className={DASHBOARD_FORM_LABEL_CLASS}>Period end</span>
            <input
              type="date"
              className={DASHBOARD_FORM_INPUT_CLASS}
              value={form.periodEnd}
              onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="btn-primary md:col-span-2 h-10 disabled:opacity-50"
            onClick={() => void createCycle()}
          >
            Create draft cycle
          </button>
        </div>
      ) : null}

      {selectedCycle?.status === 'draft' ? (
        <div className="mt-4 dashboard-surface shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Cycle templates (draft)</h2>
          <p className="text-xs text-[var(--dash-text-muted)]">
            Goals must total 100% weight. Applied to all employees when you activate.
          </p>
          {goalTemplates.map((goal, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px]">
              <input
                className={DASHBOARD_FORM_INPUT_CLASS}
                value={goal.title}
                onChange={(e) =>
                  setGoalTemplates((rows) => rows.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r)))
                }
              />
              <input
                type="number"
                min={1}
                max={100}
                className={DASHBOARD_FORM_INPUT_CLASS}
                value={goal.weightPercent}
                onChange={(e) =>
                  setGoalTemplates((rows) =>
                    rows.map((r, i) => (i === idx ? { ...r, weightPercent: Number(e.target.value) } : r)),
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setGoalTemplates((rows) => [...rows, { title: 'New goal', weightPercent: 0 }])}
          >
            Add goal
          </button>
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--dash-text-muted)]">Rating dimensions</p>
            {ratingDimensions.map((dim, idx) => (
              <input
                key={idx}
                className={DASHBOARD_FORM_INPUT_CLASS}
                value={dim}
                onChange={(e) =>
                  setRatingDimensions((rows) => rows.map((r, i) => (i === idx ? e.target.value : r)))
                }
              />
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            className="btn-primary disabled:opacity-50"
            onClick={() => void saveCycleTemplates()}
          >
            Save templates
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Total reviews" value={total} tone="neutral" icon={Users} />
        <StatTile
          label="Self submitted"
          value={selfSubmitted}
          tone="info"
          icon={ClipboardCheck}
          hint={`${pct(selfSubmitted)} of employees`}
        />
        <StatTile
          label="Manager done"
          value={completed}
          tone="success"
          icon={CheckCircle2}
          hint={`${pct(completed)} complete`}
        />
        <StatTile
          label="Calibration"
          value={calibration}
          tone="warning"
          icon={Scale}
          hint="awaiting HR"
        />
        <StatTile label="Not started" value={notStarted} tone="neutral" icon={Clock} hint={pct(notStarted)} />
      </div>

      {analytics ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="dashboard-surface p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Rating distribution</h3>
            <p className="mb-3 text-xs text-[var(--dash-text-muted)]">Final blended BSC scores by band.</p>
            <RatingDistributionChart distribution={analytics.distribution} total={total} />
          </div>
          <div className="dashboard-surface p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">9-box talent grid</h3>
                <p className="text-xs text-[var(--dash-text-muted)]">Results x competencies — click a cell to filter.</p>
              </div>
              {nineBoxFilter ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]"
                  onClick={() => setNineBoxFilter(null)}
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              ) : null}
            </div>
            <NineBoxMatrix
              cells={analytics.nineBox}
              selected={nineBoxFilter}
              onSelect={setNineBoxFilter}
            />
          </div>
        </div>
      ) : null}

      <DashboardTableCard className="mt-4">
        <DashboardTableToolbar>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <DashboardTableSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search employee, number, department…"
              />
            </div>
            <StrideSelect
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                { value: '', label: 'All departments' },
                ...departmentOptions.map((d) => ({ value: d, label: d })),
              ]}
              ariaLabel="Department filter"
              className="sm:w-52"
            />
            <StrideSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'All statuses' },
                ...statusOptions.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
              ]}
              ariaLabel="Status filter"
              className="sm:w-52"
            />
          </div>
          {nineBoxFilter ? (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dash-surface-muted)] px-2.5 py-1 text-xs text-[var(--dash-text-body)]">
                9-box: {nineBoxFilter.resultsBand} results · {nineBoxFilter.competencyBand} competencies
                <button type="button" onClick={() => setNineBoxFilter(null)} aria-label="Clear 9-box filter">
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          ) : null}
        </DashboardTableToolbar>
        <DashboardTableViewport minWidth={960}>
          {loading ? (
            <TableSkeleton />
          ) : (
            <DashboardTable>
              <thead>
                <tr>
                  <SortHead label="Employee" sortKey="employee" sort={sort} setSort={setSort} />
                  <SortHead label="Department" sortKey="department" sort={sort} setSort={setSort} />
                  <SortHead label="Status" sortKey="status" sort={sort} setSort={setSort} />
                  <SortHead label="Self rating" sortKey="self" sort={sort} setSort={setSort} />
                  <SortHead label="Manager rating" sortKey="manager" sort={sort} setSort={setSort} />
                  <SortHead label="Final BSC" sortKey="final" sort={sort} setSort={setSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <DashboardTableEmpty colSpan={6}>
                    {selectedCycle?.status === 'draft'
                      ? 'Activate the cycle to create reviews for all active employees.'
                      : 'No reviews match your filters.'}
                  </DashboardTableEmpty>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--dash-border-subtle)]">
                      <DashboardTableCell>
                        <Link
                          href={`/dashboard/performance/reviews/${row.id}`}
                          className="font-medium text-primary-800 hover:underline"
                        >
                          {row.employeeName}
                        </Link>
                        {row.employeeNumber ? (
                          <div className="text-xs text-[var(--dash-text-muted)]">{row.employeeNumber}</div>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>{row.departmentName ?? '—'}</DashboardTableCell>
                      <DashboardTableCell>
                        <span className={dashStatusChip(statusTone(row.status))}>
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <ScoreBar score={row.overallSelfRating} />
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <ScoreBar score={row.overallManagerRating} />
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <ScoreBar score={row.finalBlendedScore} showLabel />
                      </DashboardTableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </DashboardTable>
          )}
        </DashboardTableViewport>
      </DashboardTableCard>
    </DashboardPage>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-12 w-full animate-pulse rounded-lg bg-[var(--dash-surface-muted)]"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}
