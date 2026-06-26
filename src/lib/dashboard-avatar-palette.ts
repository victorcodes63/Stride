/** Deterministic avatar chip colors — light + dark mode safe. */
export const DASHBOARD_AVATAR_PALETTE = [
  'bg-primary-100 text-primary-800 ring-primary-200/80 dark:bg-primary-500/20 dark:text-primary-100 dark:ring-primary-500/35',
  'bg-sky-100 text-sky-800 ring-sky-200/80 dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-500/35',
  'bg-violet-100 text-violet-800 ring-violet-200/80 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-500/35',
  'bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-500/35',
  'bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-500/35',
  'bg-rose-100 text-rose-800 ring-rose-200/80 dark:bg-rose-500/20 dark:text-rose-100 dark:ring-rose-500/35',
] as const;

export function dashboardAvatarClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return DASHBOARD_AVATAR_PALETTE[Math.abs(hash) % DASHBOARD_AVATAR_PALETTE.length];
}

export function dashboardInitials(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

export function dashboardDeptInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || '?';
}
