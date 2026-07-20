import type { ReactNode } from 'react';
import { UserCircle2 } from 'lucide-react';
import { formatProcurementDate } from '@/lib/procurement/types';
import { ProcurementStatusChip } from './ProcurementStatusChip';

export type ApprovalChainStep = {
  stepOrder: number;
  /** Resolved approver display name (falls back to role, then "Unassigned"). */
  approverName?: string | null;
  approverRole?: string | null;
  /** PurchaseApprovalStepStatus value: pending | approved | rejected | skipped. */
  status: string;
  actedAt?: Date | string | null;
  comment?: string | null;
  /** Optional per-step action slot (e.g. approve/reject buttons). */
  action?: ReactNode;
};

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function approverLabel(step: ApprovalChainStep): string {
  if (step.approverName) return step.approverName;
  if (step.approverRole) return step.approverRole.replace(/_/g, ' ');
  return 'Unassigned';
}

/**
 * Ordered, presentational list of purchase-request approval steps: approver name/role, status
 * chip, timestamp, and comment, with an optional per-step action slot. No data fetching.
 */
export function ApprovalChain({
  steps,
  className,
}: {
  steps: ApprovalChainStep[];
  className?: string;
}) {
  if (steps.length === 0) {
    return (
      <p className={cn('text-sm text-[var(--dash-text-muted)]', className)}>
        No approval steps configured.
      </p>
    );
  }

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <ol className={cn('flex flex-col gap-2', className)}>
      {ordered.map((step) => (
        <li
          key={step.stepOrder}
          className="flex items-start gap-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2.5"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--dash-surface-muted)] text-xs font-semibold text-[var(--dash-text-body)]">
            {step.stepOrder}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--dash-text-strong)]">
                <UserCircle2 className="h-4 w-4 text-[var(--dash-text-muted)]" aria-hidden />
                <span className="truncate capitalize">{approverLabel(step)}</span>
              </span>
              <ProcurementStatusChip kind="approval" status={step.status} />
              {step.actedAt ? (
                <span className="text-xs text-[var(--dash-text-muted)]">
                  {formatProcurementDate(step.actedAt)}
                </span>
              ) : null}
            </div>
            {step.comment ? (
              <p className="mt-1 text-xs text-[var(--dash-text-muted)]">{step.comment}</p>
            ) : null}
          </div>
          {step.action ? <div className="shrink-0">{step.action}</div> : null}
        </li>
      ))}
    </ol>
  );
}
