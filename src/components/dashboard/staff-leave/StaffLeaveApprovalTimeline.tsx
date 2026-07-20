'use client';

import { Check, Clock3, X, MinusCircle } from 'lucide-react';

export type ApprovalStep = {
  id: string;
  stepOrder: number;
  status: string;
  actedAt: string | null;
  approver: { id: string; name: string };
};

export type ApprovalAction = {
  id: string;
  action: string;
  note: string | null;
  createdAt: string;
  actor: { id: string; name: string };
};

function stepVisual(status: string): { ring: string; dot: string; icon: React.ReactNode; label: string } {
  switch (status) {
    case 'approved':
      return {
        ring: 'border-emerald-500 bg-emerald-500 text-white',
        dot: 'bg-emerald-500',
        icon: <Check className="h-3.5 w-3.5" />,
        label: 'Approved',
      };
    case 'rejected':
      return {
        ring: 'border-red-500 bg-red-500 text-white',
        dot: 'bg-red-500',
        icon: <X className="h-3.5 w-3.5" />,
        label: 'Rejected',
      };
    case 'skipped':
      return {
        ring: 'border-neutral-300 bg-neutral-200 text-neutral-500',
        dot: 'bg-neutral-300',
        icon: <MinusCircle className="h-3.5 w-3.5" />,
        label: 'Skipped',
      };
    default:
      return {
        ring: 'border-amber-400 bg-white text-amber-500',
        dot: 'bg-amber-400',
        icon: <Clock3 className="h-3.5 w-3.5" />,
        label: 'Awaiting',
      };
  }
}

/**
 * Vertical multi-step approval progress for a single leave request.
 * Highlights the step currently awaiting action.
 */
export function StaffLeaveApprovalTimeline({
  steps,
  currentStepOrder,
}: {
  steps: ApprovalStep[];
  currentStepOrder?: number;
}) {
  if (steps.length === 0) {
    return <p className="text-xs text-neutral-500">No approval chain — this request is decided in a single step.</p>;
  }

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <ol className="space-y-0">
      {ordered.map((step, index) => {
        const visual = stepVisual(step.status);
        const isCurrent = step.status === 'pending' && step.stepOrder === currentStepOrder;
        const isLast = index === ordered.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span className="absolute left-[11px] top-6 h-full w-px bg-neutral-200" aria-hidden />
            ) : null}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${visual.ring}`}
            >
              {visual.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-neutral-800">{step.approver.name}</span>
                {isCurrent ? (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    Awaiting them
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-neutral-500">
                Step {step.stepOrder} · {visual.label}
                {step.actedAt ? ` · ${step.actedAt.slice(0, 10)}` : ''}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
