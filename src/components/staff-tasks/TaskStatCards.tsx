import { AlertCircle, CheckCircle2, ListTodo } from 'lucide-react';
import type { TaskStats } from './types';
import { DashboardStatBadge, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';

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
      attention: false,
    },
    {
      key: 'overdue' as const,
      label: 'Overdue',
      value: stats.overdue,
      icon: AlertCircle,
      attention: stats.overdue > 0,
    },
    {
      key: 'done' as const,
      label: 'Completed',
      value: stats.done,
      icon: CheckCircle2,
      attention: false,
    },
  ] as const;

  return (
    <div className="mb-6">
      <DashboardStatGrid columns={3} className="!gap-2 sm:!gap-3">
        {cards.map(({ key, label, value, icon, attention }) => {
          const isActive = active === key;
          return (
            <DashboardStatBadge
              key={key}
              label={label}
              value={loading ? '—' : value}
              icon={icon}
              attention={attention || isActive}
              size="compact"
              onClick={onSelect ? () => onSelect(key) : undefined}
              className={
                isActive
                  ? 'ring-1 ring-primary-200 dark:ring-primary-800'
                  : undefined
              }
            />
          );
        })}
      </DashboardStatGrid>
    </div>
  );
}
