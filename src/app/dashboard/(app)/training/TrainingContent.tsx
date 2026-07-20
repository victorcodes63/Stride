'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  CheckCircle2,
  GraduationCap,
  LayoutGrid,
  LayoutList,
  Layers,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { DashboardAsyncState, DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard } from '@/components/dashboard/DashboardStatGrid';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import {
  DashboardTable,
  DashboardTableActions,
  DashboardTableActionButton,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableFooter,
  DashboardTableHead,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import {
  TRAINING_STATUS_LABEL,
  trainingStatusTone,
  type TrainingProgramSummary,
  type TrainingStatus,
} from '@/lib/training/types';
import { TrainingProgramCard } from '@/components/dashboard/training/TrainingProgramCard';
import { TrainingProgramFormModal } from '@/components/dashboard/training/TrainingProgramFormModal';
import {
  collectCategories,
  completionRate,
  formatDateRange,
  formatDuration,
} from '@/components/dashboard/training/training-format';

const TAB_VALUES = ['all', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const;
type TrainingTab = (typeof TAB_VALUES)[number];

type ViewMode = 'grid' | 'table';
const VIEW_STORAGE_KEY = 'stride:training:view';

export default function TrainingContent() {
  return (
    <Suspense
      fallback={<div className="py-16 text-center text-sm text-[var(--dash-text-muted)]">Loading training…</div>}
    >
      <TrainingContentInner />
    </Suspense>
  );
}

function TrainingContentInner() {
  const router = useRouter();
  const [programs, setPrograms] = useState<TrainingProgramSummary[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingProgramSummary | null>(null);
  const [toDelete, setToDelete] = useState<TrainingProgramSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { tab, setTab } = useDashboardTabParam<TrainingTab>('tab', TAB_VALUES, 'all');

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'grid' || stored === 'table') setView(stored);
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setView(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/training', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load training programs');
      setPrograms(data.programs ?? []);
      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setPrograms([]);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(() => programs ?? [], [programs]);

  const counts = useMemo(() => {
    const base: Record<TrainingTab, number> = {
      all: list.length,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const program of list) base[program.status] += 1;
    return base;
  }, [list]);

  const stats = useMemo(() => {
    const totalEnrolled = list.reduce((sum, p) => sum + p.enrollmentCount, 0);
    const totalCompleted = list.reduce((sum, p) => sum + p.completedCount, 0);
    return {
      total: list.length,
      active: counts.scheduled + counts.in_progress,
      totalEnrolled,
      totalCompleted,
      rate: completionRate(totalEnrolled, totalCompleted),
    };
  }, [list, counts]);

  const categories = useMemo(() => collectCategories(list), [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((program) => {
      if (tab !== 'all' && program.status !== tab) return false;
      if (category !== 'all' && (program.category ?? '') !== category) return false;
      if (!q) return true;
      return (
        program.title.toLowerCase().includes(q) ||
        (program.provider ?? '').toLowerCase().includes(q) ||
        (program.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [list, tab, category, search]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (program: TrainingProgramSummary) => {
    setEditing(program);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/training/${toDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success(`“${toDelete.title}” deleted.`);
      setToDelete(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete program.');
    } finally {
      setDeleting(false);
    }
  };

  const tabBadge = (value: TrainingTab) =>
    counts[value] > 0 ? (
      <span className="rounded-full bg-[var(--dash-surface-muted)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--dash-text-muted)]">
        {counts[value]}
      </span>
    ) : undefined;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Training & Development"
        icon={GraduationCap}
        description="Plan programs, track enrollments, and measure completion across your team."
        actions={
          <button type="button" onClick={openCreate} className="btn-primary inline-flex shrink-0 items-center gap-2">
            <Plus className="h-4 w-4" /> New program
          </button>
        }
        footer={
          <DashboardTabs
            embedded
            value={tab}
            onChange={setTab}
            items={[
              { value: 'all', label: 'All', icon: Layers, badge: tabBadge('all') },
              { value: 'scheduled', label: 'Scheduled', badge: tabBadge('scheduled') },
              { value: 'in_progress', label: 'In progress', badge: tabBadge('in_progress') },
              { value: 'completed', label: 'Completed', badge: tabBadge('completed') },
              { value: 'cancelled', label: 'Cancelled', badge: tabBadge('cancelled') },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <DashboardMetricCard label="Total programs" value={stats.total} icon={GraduationCap} tone="primary" />
        <DashboardMetricCard label="Active" value={stats.active} icon={Layers} tone="violet" hint="Scheduled + in progress" />
        <DashboardMetricCard label="Total enrolled" value={stats.totalEnrolled} icon={Users} tone="violet" />
        <DashboardMetricCard label="Completed" value={stats.totalCompleted} icon={CheckCircle2} tone="emerald" />
        <DashboardMetricCard
          label="Completion rate"
          value={`${stats.rate}%`}
          icon={Award}
          tone="amber"
          hint="Completed of enrolled"
        />
      </div>

      <DashboardTableCard>
        <DashboardTableToolbar>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <DashboardTableSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search title, provider, category…"
              />
            </div>
            <div className="flex items-center gap-2">
              <StrideSelect
                value={category}
                onChange={setCategory}
                options={[
                  { value: 'all', label: 'All categories' },
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
                ariaLabel="Filter by category"
                size="sm"
                className="w-44"
              />
              <div className="inline-flex overflow-hidden rounded-lg border border-[var(--dash-border)]">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Card view"
                  aria-pressed={view === 'grid'}
                  className={`flex h-9 w-9 items-center justify-center transition-colors ${
                    view === 'grid'
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                  aria-pressed={view === 'table'}
                  className={`flex h-9 w-9 items-center justify-center border-l border-[var(--dash-border)] transition-colors ${
                    view === 'table'
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
                  }`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </DashboardTableToolbar>

        <div className="p-4 sm:p-5">
          <DashboardAsyncState
            status={status}
            error={error}
            onRetry={load}
            loading={
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="dashboard-surface h-56 animate-pulse p-5" />
                ))}
              </div>
            }
          >
            {filtered.length === 0 ? (
              list.length === 0 ? (
                <DashboardEmptyState
                  icon={GraduationCap}
                  title="No training programs yet"
                  description="Create your first program to start developing your team's skills."
                  action={
                    <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" /> New program
                    </button>
                  }
                />
              ) : (
                <DashboardEmptyState
                  icon={GraduationCap}
                  title="No programs match your filters"
                  description="Try adjusting the search, category, or status filters."
                />
              )
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((program, index) => (
                  <TrainingProgramCard
                    key={program.id}
                    program={program}
                    index={index}
                    onEdit={openEdit}
                    onDelete={setToDelete}
                  />
                ))}
              </div>
            ) : (
              <TrainingTableView
                programs={filtered}
                onEdit={openEdit}
                onDelete={setToDelete}
                onView={(id) => router.push(`/dashboard/training/${id}`)}
              />
            )}
          </DashboardAsyncState>
        </div>

        {status === 'success' && filtered.length > 0 ? (
          <DashboardTableFooter>
            <span>
              {filtered.length} of {list.length} program{list.length === 1 ? '' : 's'}
            </span>
          </DashboardTableFooter>
        ) : null}
      </DashboardTableCard>

      <TrainingProgramFormModal
        open={formOpen}
        program={editing}
        categoryOptions={categories}
        onClose={() => setFormOpen(false)}
        onSaved={({ id, created }) => {
          void load();
          if (created) router.push(`/dashboard/training/${id}`);
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete program"
        description={
          toDelete
            ? `Delete “${toDelete.title}”? Enrollments and materials will be removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => (!deleting ? setToDelete(null) : undefined)}
      />
    </DashboardPage>
  );
}

function TrainingTableView({
  programs,
  onEdit,
  onDelete,
  onView,
}: {
  programs: TrainingProgramSummary[];
  onEdit: (program: TrainingProgramSummary) => void;
  onDelete: (program: TrainingProgramSummary) => void;
  onView: (id: string) => void;
}) {
  return (
    <DashboardTableViewport minWidth={960}>
      <DashboardTable>
        <thead>
          <tr>
            <DashboardTableHead>Program</DashboardTableHead>
            <DashboardTableHead>Category</DashboardTableHead>
            <DashboardTableHead>Status</DashboardTableHead>
            <DashboardTableHead>Dates</DashboardTableHead>
            <DashboardTableHead>Enrolled</DashboardTableHead>
            <DashboardTableHead>Completed</DashboardTableHead>
            <DashboardTableHead>Duration</DashboardTableHead>
            <DashboardTableHead>Actions</DashboardTableHead>
          </tr>
        </thead>
        <tbody>
          {programs.length === 0 ? (
            <DashboardTableEmpty colSpan={8}>No programs found.</DashboardTableEmpty>
          ) : (
            programs.map((program) => (
              <tr key={program.id} className="border-t border-[var(--dash-border-subtle)]">
                <DashboardTableCell>
                  <Link
                    href={`/dashboard/training/${program.id}`}
                    className="font-medium text-primary-800 hover:underline"
                  >
                    {program.title}
                  </Link>
                  {program.provider ? (
                    <div className="text-xs text-[var(--dash-text-muted)]">{program.provider}</div>
                  ) : null}
                </DashboardTableCell>
                <DashboardTableCell className="text-[var(--dash-text-muted)]">
                  {program.category ?? '—'}
                </DashboardTableCell>
                <DashboardTableCell>
                  <span className={dashStatusChip(trainingStatusTone(program.status))}>
                    {TRAINING_STATUS_LABEL[program.status as TrainingStatus]}
                  </span>
                </DashboardTableCell>
                <DashboardTableCell className="text-[var(--dash-text-muted)]">
                  {formatDateRange(program.startDate, program.endDate)}
                </DashboardTableCell>
                <DashboardTableCell numeric>{program.enrollmentCount}</DashboardTableCell>
                <DashboardTableCell numeric>{program.completedCount}</DashboardTableCell>
                <DashboardTableCell className="text-[var(--dash-text-muted)]">
                  {formatDuration(program.durationHours)}
                </DashboardTableCell>
                <DashboardTableCell>
                  <DashboardTableActions>
                    <DashboardTableActionButton onClick={() => onView(program.id)}>View</DashboardTableActionButton>
                    <DashboardTableActionButton onClick={() => onEdit(program)}>Edit</DashboardTableActionButton>
                    <DashboardTableActionButton
                      onClick={() => onDelete(program)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </DashboardTableActionButton>
                  </DashboardTableActions>
                </DashboardTableCell>
              </tr>
            ))
          )}
        </tbody>
      </DashboardTable>
    </DashboardTableViewport>
  );
}
