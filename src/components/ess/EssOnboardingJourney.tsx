'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FileText,
  FileWarning,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import { EssStatusPill } from '@/components/ess/EssStatusPill';

export type EssOnboardingTaskType = 'CHECKLIST' | 'FORM' | 'SIGNATURE' | 'DOCUMENT';

export type EssOnboardingTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  isRequired: boolean;
  category: string | null;
  taskType: EssOnboardingTaskType;
  overdue: boolean;
  needsEvidence: boolean;
  document?: { id: string; fileName: string; title: string } | null;
  formSubmission?: { id: string; status: string; submittedAt: string | null } | null;
  signatureRequest?: {
    id: string;
    status: string;
    documentTitle: string | null;
    signedAt: string | null;
  } | null;
};

function isCompleted(status: string) {
  return status === 'COMPLETED' || status === 'SKIPPED';
}

/** ESS link path for a task, keyed by its rich task type. */
export function taskHref(task: EssOnboardingTask): string {
  switch (task.taskType) {
    case 'FORM':
      return `/ess/onboarding/forms/${task.id}`;
    case 'SIGNATURE':
      return `/ess/onboarding/sign/${task.id}`;
    case 'CHECKLIST':
    case 'DOCUMENT':
    default:
      return `/ess/onboarding/tasks/${task.id}`;
  }
}

function taskIcon(taskType: EssOnboardingTaskType): LucideIcon {
  switch (taskType) {
    case 'FORM':
      return ClipboardList;
    case 'SIGNATURE':
      return FileSignature;
    case 'DOCUMENT':
      return FileText;
    case 'CHECKLIST':
    default:
      return ListChecks;
  }
}

/** Human status label per task type (form/signature carry their own workflow status). */
function typeStatusLabel(task: EssOnboardingTask): string {
  if (task.taskType === 'FORM' && task.formSubmission) {
    const s = task.formSubmission.status.toUpperCase();
    if (s === 'APPROVED') return 'Approved';
    if (s === 'SUBMITTED' || s === 'PENDING_REVIEW') return 'Submitted';
    if (s === 'DRAFT') return 'Draft';
    return task.formSubmission.status;
  }
  if (task.taskType === 'SIGNATURE') {
    const s = task.signatureRequest?.status?.toUpperCase();
    if (s === 'SIGNED' || s === 'COMPLETED') return 'Signed';
    if (s) return 'Awaiting signature';
  }
  return task.status;
}

function metaLine(task: EssOnboardingTask): string {
  const parts = [
    task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : null,
    task.isRequired ? 'Required' : 'Optional',
    task.needsEvidence ? 'Evidence needed' : null,
    task.taskType === 'FORM' ? 'Form' : null,
    task.taskType === 'SIGNATURE' ? 'Signature' : null,
    task.taskType === 'DOCUMENT' ? 'Document' : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function TimelineStep({ task, isLast }: { task: EssOnboardingTask; isLast: boolean }) {
  const done = isCompleted(task.status);
  const Icon = taskIcon(task.taskType);

  return (
    <li className="relative pl-11">
      {!isLast ? (
        <span
          aria-hidden
          className="absolute left-[18px] top-9 bottom-[-14px] w-px bg-[var(--ess-border)]"
        />
      ) : null}
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 flex h-9 w-9 items-center justify-center rounded-2xl ${
          done
            ? 'bg-emerald-500/12 text-emerald-600'
            : task.overdue
              ? 'bg-red-500/12 text-red-600'
              : 'bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]'
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>

      <Link
        href={taskHref(task)}
        className="block rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-4 py-3 transition-transform active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[var(--ess-text)]">{task.title}</p>
            {task.description ? (
              <p className="mt-0.5 line-clamp-2 text-sm text-[var(--ess-muted)]">{task.description}</p>
            ) : null}
            <p className="mt-1 text-xs text-[var(--ess-subtle)]">{metaLine(task)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <EssStatusPill status={typeStatusLabel(task)} />
            {task.overdue && !done ? (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase text-red-600">
                <FileWarning className="h-3 w-3" />
                Overdue
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Groups tasks into "phases" by category, preserving incoming order. */
function groupByPhase(tasks: EssOnboardingTask[]) {
  const order: string[] = [];
  const map = new Map<string, EssOnboardingTask[]>();
  for (const task of tasks) {
    const phase = task.category?.trim() || 'General';
    if (!map.has(phase)) {
      map.set(phase, []);
      order.push(phase);
    }
    map.get(phase)!.push(task);
  }
  return order.map((phase) => ({ phase, tasks: map.get(phase)! }));
}

export function EssOnboardingJourney({ tasks }: { tasks: EssOnboardingTask[] }) {
  const phases = groupByPhase(tasks);

  return (
    <div className="space-y-6">
      {phases.map(({ phase, tasks: phaseTasks }) => {
        const doneCount = phaseTasks.filter((t) => isCompleted(t.status)).length;
        return (
          <div key={phase}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.08em] text-[var(--ess-muted)]">
                {phase}
              </h3>
              <span className="text-xs font-bold text-[var(--ess-subtle)]">
                {doneCount}/{phaseTasks.length}
              </span>
            </div>
            <ol className="space-y-3.5">
              {phaseTasks.map((task, index) => (
                <TimelineStep
                  key={task.id}
                  task={task}
                  isLast={index === phaseTasks.length - 1}
                />
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
