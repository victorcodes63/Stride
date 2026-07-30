import { AlertCircle, CheckCircle2, ListTodo } from 'lucide-react';
import type { TaskStats } from './types';

export type TaskStatKey = 'open' | 'overdue' | 'done';

type Props = {
  stats: TaskStats;
  loading?: boolean;
  active?: TaskStatKey | null;
  onSelect?: (key: TaskStatKey) => void;
};

export function TaskStatCards({ stats, loading, active = null, onSelect }: Props) {
  const cards = [
    {
      key: 'open' as const,
      label: 'Open',
      value: stats.open,
      icon: ListTodo,
      tone: {
        idle: 'text-primary-800',
        value: 'text-primary-900',
        icon: 'bg-primary-100 text-primary-700',
        active: 'bg-primary-50 ring-1 ring-primary-200 shadow-sm',
        bar: 'bg-primary-600',
      },
    },
    {
      key: 'overdue' as const,
      label: 'Overdue',
      value: stats.overdue,
      icon: AlertCircle,
      tone: {
        idle: stats.overdue > 0 ? 'text-red-800' : 'text-neutral-600',
        value: stats.overdue > 0 ? 'text-red-700' : 'text-primary-900',
        icon: stats.overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-500',
        active: 'bg-red-50 ring-1 ring-red-200 shadow-sm',
        bar: stats.overdue > 0 ? 'bg-red-500' : 'bg-neutral-300',
      },
    },
    {
      key: 'done' as const,
      label: 'Completed',
      value: stats.done,
      icon: CheckCircle2,
      tone: {
        idle: 'text-emerald-800',
        value: 'text-emerald-700',
        icon: 'bg-emerald-100 text-emerald-700',
        active: 'bg-emerald-50 ring-1 ring-emerald-200 shadow-sm',
        bar: 'bg-emerald-500',
      },
    },
  ] as const;

  return (
    <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
      {cards.map(({ key, label, value, icon: Icon, tone }) => {
        const isActive = active === key;
        const interactive = Boolean(onSelect);
        const className = [
          'relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white px-3 py-3 sm:px-4 sm:py-3.5 text-left transition-all duration-200',
          isActive ? tone.active : 'hover:border-neutral-300/90',
          interactive
            ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40'
            : '',
        ]
          .filter(Boolean)
          .join(' ');

        const body = (
          <>
            <span
              className={`absolute inset-y-0 left-0 w-0.5 ${tone.bar} ${isActive ? 'opacity-100' : 'opacity-70'}`}
              aria-hidden
            />
            <div className="flex items-center gap-2.5 sm:gap-3 pl-1">
              <span
                className={`hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p
                  className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest ${
                    isActive ? tone.idle : 'text-neutral-500'
                  }`}
                >
                  {label}
                </p>
                <p className={`mt-0.5 text-xl sm:text-2xl font-bold tabular-nums tracking-tight ${tone.value}`}>
                  {loading ? '—' : value}
                </p>
              </div>
            </div>
          </>
        );

        if (interactive) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect?.(key)}
              aria-pressed={isActive}
              title={isActive ? 'Clear filter' : `Show ${label.toLowerCase()} tasks`}
              className={className}
            >
              {body}
            </button>
          );
        }

        return (
          <div key={key} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
