/** Dashboard appearance preference — persisted via next-themes (localStorage). */

export const DASHBOARD_THEME_STORAGE_KEY = 'hris-dashboard:theme';

export type DashboardAppearance = 'light' | 'dark' | 'system';

export const DASHBOARD_APPEARANCE_OPTIONS: {
  value: DashboardAppearance;
  label: string;
  description: string;
}[] = [
  { value: 'light', label: 'Light', description: 'Bright workspace with frosted panels' },
  { value: 'dark', label: 'Dark', description: 'Low-glare ink canvas for long sessions' },
  { value: 'system', label: 'System', description: 'Match your device appearance' },
];
