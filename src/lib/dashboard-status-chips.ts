/** Mode-aware status chips for dashboard tables — pair with `.dash-status-chip` in dashboard-theme.css */
export type DashStatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral' | 'primary';

export function dashStatusChip(tone: DashStatusTone): string {
  return `dash-status-chip dash-status-chip--${tone}`;
}
