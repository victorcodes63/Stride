'use client';

import { Pin, PinOff } from 'lucide-react';

type Props = {
  isPinned: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
};

/** Pin control for dashboard overview widgets and KPI tiles. */
export function OverviewPinButton({ isPinned, label, onToggle, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--dash-text-subtle)] opacity-0 transition hover:bg-[var(--dash-hover)] hover:text-primary-600 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500/30 group-hover/pin-target:opacity-100 ${
        isPinned ? 'text-primary-600 opacity-100' : ''
      } ${className}`}
      title={isPinned ? `Unpin ${label}` : `Pin ${label} to your dashboard`}
      aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
      aria-pressed={isPinned}
    >
      {isPinned ? <PinOff className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />}
    </button>
  );
}
