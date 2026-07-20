import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Check,
  ClipboardList,
  FileSignature,
  PackageCheck,
  Receipt,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

export type P2PStageKey =
  | 'requested'
  | 'approved'
  | 'ordered'
  | 'received'
  | 'invoiced'
  | 'paid';

export type P2PStageState = 'done' | 'current' | 'pending' | 'blocked';

export type P2PStage = {
  key: P2PStageKey;
  /** Override the default stage label. */
  label?: string;
  state: P2PStageState;
  /** Optional supporting line under the label (date, doc number, amount). */
  meta?: ReactNode;
};

const STAGE_META: Record<P2PStageKey, { label: string; icon: LucideIcon }> = {
  requested: { label: 'Requested', icon: ClipboardList },
  approved: { label: 'Approved', icon: ShieldCheck },
  ordered: { label: 'Ordered', icon: FileSignature },
  received: { label: 'Received', icon: PackageCheck },
  invoiced: { label: 'Invoiced', icon: Receipt },
  paid: { label: 'Paid', icon: Wallet },
};

export const P2P_STAGE_ORDER: P2PStageKey[] = [
  'requested',
  'approved',
  'ordered',
  'received',
  'invoiced',
  'paid',
];

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function nodeClasses(state: P2PStageState) {
  switch (state) {
    case 'done':
      return 'border-transparent bg-primary-600 text-white';
    case 'current':
      return 'border-primary-500 bg-[var(--dash-surface)] text-primary-600 ring-4 ring-primary-500/15';
    case 'blocked':
      return 'border-transparent bg-red-500 text-white';
    case 'pending':
    default:
      return 'border-[var(--dash-border)] bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]';
  }
}

function labelClasses(state: P2PStageState) {
  switch (state) {
    case 'done':
    case 'current':
      return 'text-[var(--dash-text-strong)]';
    case 'blocked':
      return 'text-red-600';
    case 'pending':
    default:
      return 'text-[var(--dash-text-muted)]';
  }
}

function connectorClasses(done: boolean) {
  return done ? 'bg-primary-500' : 'bg-[var(--dash-border)]';
}

/**
 * Procure-to-pay stepper (Requested → Approved → Ordered → Received → Invoiced → Paid).
 * Pure presentational; pass each stage's `state`. Uses platform tokens + coral accent and
 * supports dark mode via CSS variables.
 */
export function P2PTimeline({
  stages,
  orientation = 'horizontal',
  className,
}: {
  stages: P2PStage[];
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  if (orientation === 'vertical') {
    return (
      <ol className={cn('flex flex-col', className)} aria-label="Procure-to-pay progress">
        {stages.map((stage, index) => {
          const meta = STAGE_META[stage.key];
          const Icon = stage.state === 'done' ? Check : meta.icon;
          const isLast = index === stages.length - 1;
          return (
            <li key={stage.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    nodeClasses(stage.state),
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                {!isLast ? (
                  <span className={cn('my-1 w-0.5 flex-1', connectorClasses(stage.state === 'done'))} />
                ) : null}
              </div>
              <div className={cn('pb-6', isLast && 'pb-0')}>
                <p className={cn('text-sm font-medium', labelClasses(stage.state))}>
                  {stage.label ?? meta.label}
                </p>
                {stage.meta ? (
                  <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">{stage.meta}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={cn('flex w-full items-start', className)} aria-label="Procure-to-pay progress">
      {stages.map((stage, index) => {
        const meta = STAGE_META[stage.key];
        const Icon = stage.state === 'done' ? Check : meta.icon;
        const isLast = index === stages.length - 1;
        return (
          <li key={stage.key} className={cn('flex flex-col items-center', !isLast && 'flex-1')}>
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  nodeClasses(stage.state),
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              {!isLast ? (
                <span className={cn('mx-2 h-0.5 flex-1', connectorClasses(stage.state === 'done'))} />
              ) : null}
            </div>
            <div className="mt-2 max-w-[7rem] text-center">
              <p className={cn('text-xs font-medium leading-tight', labelClasses(stage.state))}>
                {stage.label ?? meta.label}
              </p>
              {stage.meta ? (
                <p className="mt-0.5 text-[10px] leading-tight text-[var(--dash-text-muted)]">{stage.meta}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
