'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
  Pencil,
  TicketPercent,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import {
  TRAINING_STATUS_LABEL,
  trainingStatusTone,
  type TrainingProgramDetail,
} from '@/lib/training/types';
import { EnrollmentRoster } from '@/components/dashboard/training/EnrollmentRoster';
import { MaterialsPanel } from '@/components/dashboard/training/MaterialsPanel';
import { TrainingProgramFormModal } from '@/components/dashboard/training/TrainingProgramFormModal';
import {
  completionRate,
  formatCurrency,
  formatDateRange,
  formatDelivery,
  formatDuration,
  formatScore,
} from '@/components/dashboard/training/training-format';

type TrainingProgramDetailContentProps = {
  programId: string;
};

export default function TrainingProgramDetailContent({ programId }: TrainingProgramDetailContentProps) {
  const router = useRouter();
  const [program, setProgram] = useState<TrainingProgramDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setStatus('loading');
      setError(null);
      try {
        const res = await fetch(`/api/training/${programId}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load program');
        setProgram(data.program as TrainingProgramDetail);
        setStatus('success');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setStatus('error');
      }
    },
    [programId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const analytics = useMemo(() => {
    if (!program) return null;
    const enrollments = program.enrollments ?? [];
    const enrolled = enrollments.length;
    const completed = enrollments.filter((e) => e.status === 'completed').length;
    const inProgress = enrollments.filter((e) => e.status === 'in_progress').length;
    const scored = enrollments.filter((e) => e.score != null) as Array<{ score: number }>;
    const avgScore = scored.length
      ? scored.reduce((sum, e) => sum + e.score, 0) / scored.length
      : null;
    const seatsRemaining =
      program.maxParticipants != null ? Math.max(0, program.maxParticipants - enrolled) : null;
    return {
      enrolled,
      completed,
      inProgress,
      rate: completionRate(enrolled, completed),
      avgScore,
      seatsRemaining,
    };
  }, [program]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/training/${programId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Program deleted.');
      router.push('/dashboard/training');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete program.');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <DashboardPage>
      <Link
        href="/dashboard/training"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-strong)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to training
      </Link>

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={() => load()}
      >
        {program ? (
          <>
            <DashboardPageHeader
              title={program.title}
              description={program.description ?? undefined}
              badges={[
                {
                  bare: true,
                  label: (
                    <span className={dashStatusChip(trainingStatusTone(program.status))}>
                      {TRAINING_STATUS_LABEL[program.status]}
                    </span>
                  ),
                },
                ...(program.category
                  ? [{ label: program.category, icon: Award }]
                  : []),
              ]}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:bg-transparent dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              }
            />

            {analytics ? (
              <DashboardStatGrid columns={6}>
                <DashboardStatCard label="Enrolled" value={analytics.enrolled} tone="violet" />
                <DashboardStatCard label="In progress" value={analytics.inProgress} tone="sky" />
                <DashboardStatCard label="Completed" value={analytics.completed} tone="success" />
                <DashboardStatCard label="Completion rate" value={`${analytics.rate}%`} tone="primary" />
                <DashboardStatCard
                  label="Average score"
                  value={analytics.avgScore != null ? formatScore(analytics.avgScore) : '—'}
                  tone="warning"
                />
                <DashboardStatCard
                  label="Seats remaining"
                  value={analytics.seatsRemaining != null ? analytics.seatsRemaining : '∞'}
                  tone="primary"
                />
              </DashboardStatGrid>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <ProgramOverview program={program} rate={analytics?.rate ?? 0} />
                <EnrollmentRoster
                  programId={programId}
                  enrollments={program.enrollments ?? []}
                  onRefresh={() => load(true)}
                />
              </div>
              <div className="space-y-4">
                <MaterialsPanel
                  programId={programId}
                  materials={program.materials ?? []}
                  onRefresh={() => load(true)}
                />
              </div>
            </div>

            <TrainingProgramFormModal
              open={editOpen}
              program={program}
              onClose={() => setEditOpen(false)}
              onSaved={() => load(true)}
            />

            <ConfirmDialog
              open={deleteOpen}
              title="Delete program"
              description={`Delete “${program.title}”? Enrollments and materials will be removed. This cannot be undone.`}
              confirmLabel="Delete"
              tone="danger"
              loading={deleting}
              onConfirm={confirmDelete}
              onCancel={() => (!deleting ? setDeleteOpen(false) : undefined)}
            />
          </>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}

function ProgramOverview({ program, rate }: { program: TrainingProgramDetail; rate: number }) {
  const facts: Array<{ icon: typeof Users; label: string; value: string }> = [
    { icon: Users, label: 'Provider', value: program.provider?.trim() || '—' },
    {
      icon: program.isOnline ? Globe : MapPin,
      label: 'Delivery',
      value: formatDelivery(program),
    },
    { icon: CalendarDays, label: 'Dates', value: formatDateRange(program.startDate, program.endDate) },
    { icon: Clock, label: 'Duration', value: formatDuration(program.durationHours) },
    { icon: Banknote, label: 'Cost', value: formatCurrency(program.cost, program.currency) },
    {
      icon: TicketPercent,
      label: 'Max participants',
      value: program.maxParticipants != null ? String(program.maxParticipants) : 'Unlimited',
    },
    { icon: Award, label: 'Category', value: program.category?.trim() || '—' },
  ];

  return (
    <div className={`${DASHBOARD_SURFACE_CLASS} p-5 shadow-sm`}>
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary-600" />
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Overview</h2>
      </div>

      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--dash-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completion progress
          </span>
          <span className="tabular-nums">{rate}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
          <div
            className="h-full rounded-full bg-[var(--swatch-emerald-accent,#10b981)] transition-all"
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {facts.map((fact) => {
          const Icon = fact.icon;
          return (
            <div key={fact.label} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-surface-muted)] text-primary-600">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--dash-text-muted)]">
                  {fact.label}
                </dt>
                <dd className="mt-0.5 break-words text-sm text-[var(--dash-text-strong)]">{fact.value}</dd>
              </div>
            </div>
          );
        })}
      </dl>

      {program.notes ? (
        <div className="mt-5 border-t border-[var(--dash-border-subtle)] pt-4">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--dash-text-muted)]">
            Internal notes
          </p>
          <p className="whitespace-pre-wrap text-sm text-[var(--dash-text-body)]">{program.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
