'use client';

import { useState } from 'react';
import { Loader2, Trash2, UserPlus, Users } from 'lucide-react';
import {
  DashboardTable,
  DashboardTableActions,
  DashboardTableActionButton,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableHead,
  DashboardTableMeta,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import {
  ENROLLMENT_STATUSES,
  ENROLLMENT_STATUS_LABEL,
  type EnrollmentStatus,
  type TrainingEnrollmentRow,
  type TrainingEnrollmentUpdate,
} from '@/lib/training/types';
import { formatTrainingDate } from './training-format';

type EnrollmentRosterProps = {
  programId: string;
  enrollments: TrainingEnrollmentRow[];
  onRefresh: () => Promise<void> | void;
};

export function EnrollmentRoster({ programId, enrollments, onRefresh }: EnrollmentRosterProps) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [toRemove, setToRemove] = useState<TrainingEnrollmentRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const addEnrollee = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter an enrollee name.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/training/${programId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enrolleeName: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add enrollee');
      toast.success(`${trimmed} enrolled.`);
      setName('');
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add enrollee.');
    } finally {
      setAdding(false);
    }
  };

  const patchEnrollment = async (
    enrollment: TrainingEnrollmentRow,
    update: TrainingEnrollmentUpdate,
    successMessage: string,
  ) => {
    setBusyId(enrollment.id);
    try {
      const res = await fetch(`/api/training/${programId}/enrollments/${enrollment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(update),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success(successMessage);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = (enrollment: TrainingEnrollmentRow, status: EnrollmentStatus) => {
    if (status === enrollment.status) return;
    const update: TrainingEnrollmentUpdate = { status };
    // Stamp completion time when moving to completed and none recorded yet.
    if (status === 'completed' && !enrollment.completedAt) {
      update.completedAt = new Date().toISOString();
    }
    void patchEnrollment(enrollment, update, 'Status updated.');
  };

  const commitScore = (enrollment: TrainingEnrollmentRow) => {
    const draft = scoreDrafts[enrollment.id];
    if (draft == null) return;
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed != null && Number.isNaN(parsed)) {
      toast.error('Score must be a number.');
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[enrollment.id];
        return next;
      });
      return;
    }
    if (parsed === enrollment.score || (parsed == null && enrollment.score == null)) {
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[enrollment.id];
        return next;
      });
      return;
    }
    void patchEnrollment(enrollment, { score: parsed }, 'Score saved.').then(() => {
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[enrollment.id];
        return next;
      });
    });
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/training/${programId}/enrollments/${toRemove.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      toast.success('Enrollee removed.');
      setToRemove(null);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <DashboardTableCard>
      <DashboardTableMeta
        title="Enrollment roster"
        description={`${enrollments.length} enrollee${enrollments.length === 1 ? '' : 's'}`}
        actions={
          <form onSubmit={addEnrollee} className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enrollee name"
              aria-label="Enrollee name"
              className="h-9 w-44 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:w-56"
            />
            <button
              type="submit"
              disabled={adding}
              className="btn-primary inline-flex h-9 items-center gap-1.5 px-3 text-sm disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add
            </button>
          </form>
        }
      />
      <DashboardTableViewport minWidth={760}>
        <DashboardTable>
          <thead>
            <tr>
              <DashboardTableHead>Name</DashboardTableHead>
              <DashboardTableHead>Status</DashboardTableHead>
              <DashboardTableHead>Enrolled</DashboardTableHead>
              <DashboardTableHead>Completed</DashboardTableHead>
              <DashboardTableHead>Score</DashboardTableHead>
              <DashboardTableHead>Actions</DashboardTableHead>
            </tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <DashboardTableEmpty colSpan={6} icon={<Users className="h-7 w-7 text-neutral-300" />}>
                No one is enrolled yet. Add the first enrollee above.
              </DashboardTableEmpty>
            ) : (
              enrollments.map((enrollment) => {
                const busy = busyId === enrollment.id;
                const scoreValue =
                  scoreDrafts[enrollment.id] ??
                  (enrollment.score != null ? String(enrollment.score) : '');
                return (
                  <tr key={enrollment.id} className="border-t border-[var(--dash-border-subtle)]">
                    <DashboardTableCell>
                      <span className="font-medium text-[var(--dash-text-strong)]">{enrollment.enrolleeName}</span>
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <div className="flex items-center gap-2">
                        <StrideSelect
                          value={enrollment.status}
                          onChange={(value) => changeStatus(enrollment, value as EnrollmentStatus)}
                          options={ENROLLMENT_STATUSES.map((status) => ({
                            value: status,
                            label: ENROLLMENT_STATUS_LABEL[status],
                          }))}
                          ariaLabel={`Status for ${enrollment.enrolleeName}`}
                          size="sm"
                          disabled={busy}
                          className="w-36"
                        />
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" /> : null}
                      </div>
                    </DashboardTableCell>
                    <DashboardTableCell className="text-[var(--dash-text-muted)]">
                      {formatTrainingDate(enrollment.enrolledAt)}
                    </DashboardTableCell>
                    <DashboardTableCell className="text-[var(--dash-text-muted)]">
                      {formatTrainingDate(enrollment.completedAt)}
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={scoreValue}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({ ...prev, [enrollment.id]: e.target.value }))
                        }
                        onBlur={() => commitScore(enrollment)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        placeholder="—"
                        aria-label={`Score for ${enrollment.enrolleeName}`}
                        disabled={busy}
                        className="h-9 w-20 rounded-lg border border-neutral-300 bg-white px-2 text-sm tabular-nums text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50"
                      />
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <DashboardTableActions>
                        <DashboardTableActionButton
                          onClick={() => setToRemove(enrollment)}
                          className="text-red-600 hover:bg-red-50"
                          aria-label={`Remove ${enrollment.enrolleeName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </DashboardTableActionButton>
                      </DashboardTableActions>
                    </DashboardTableCell>
                  </tr>
                );
              })
            )}
          </tbody>
        </DashboardTable>
      </DashboardTableViewport>

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Remove enrollee"
        description={
          toRemove
            ? `Remove ${toRemove.enrolleeName} from this program? This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove"
        tone="danger"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => (!removing ? setToRemove(null) : undefined)}
      />
    </DashboardTableCard>
  );
}
