'use client';

import { TaskAvatar } from '@/components/onboarding/TaskAvatar';

export type WorkflowOwner = { id: string; name: string };

/** Overlapping avatar stack for the distinct people who own tasks in a workflow. */
export function WorkflowOwners({
  owners,
  max = 4,
  size = 'sm',
  className,
}: {
  owners: WorkflowOwner[];
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (owners.length === 0) {
    return (
      <span className="text-xs text-[var(--dash-text-muted)]">Unassigned · role pool</span>
    );
  }

  const shown = owners.slice(0, max);
  const overflow = owners.length - shown.length;
  const names = owners.map((o) => o.name).join(', ');

  return (
    <div className={`flex items-center ${className ?? ''}`} aria-label={`Owners: ${names}`}>
      <div className="flex -space-x-2">
        {shown.map((owner) => (
          <span
            key={owner.id}
            className="rounded-full ring-2 ring-[var(--dash-surface-solid)]"
            title={owner.name}
          >
            <TaskAvatar name={owner.name} size={size} />
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--dash-surface-muted)] text-[11px] font-semibold text-[var(--dash-text-muted)] ring-2 ring-[var(--dash-surface-solid)]"
            title={`${overflow} more`}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    </div>
  );
}
