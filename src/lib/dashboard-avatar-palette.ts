/** Deterministic avatar chip — uses `.dash-avatar-chip` tokens in dashboard-theme.css (mode-aware). */
export const DASHBOARD_AVATAR_VARIANT_COUNT = 6;

export function dashboardAvatarClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % DASHBOARD_AVATAR_VARIANT_COUNT;
  return `dash-avatar-chip dash-avatar-chip--${index}`;
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
