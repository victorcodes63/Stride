'use client';

import { avatarColor, initials } from '@/components/onboarding/task-view';

type Size = 'sm' | 'md';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
};

/** Colored initials chip used for participants and assignees. */
export function TaskAvatar({
  name,
  seed,
  size = 'sm',
  muted = false,
}: {
  name: string;
  seed?: string;
  size?: Size;
  muted?: boolean;
}) {
  const color = avatarColor(seed ?? name);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZE_CLASS[size]}`}
      style={
        muted
          ? { background: 'var(--dash-surface-muted)', color: 'var(--dash-text-muted)' }
          : { background: color.bg, color: color.fg }
      }
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
