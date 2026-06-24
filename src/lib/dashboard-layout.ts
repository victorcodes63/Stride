/** Fixed sidebar width (px) — keep in sync with layout `lg:ml-[280px]`. */
export const DASHBOARD_SIDEBAR_WIDTH = 280;

/**
 * Symmetric horizontal inset for the dashboard shell (top bar + main).
 * Kept modest so data views use the full canvas; scales slightly on larger screens.
 */
export const DASHBOARD_SHELL_GUTTER = 'px-4 sm:px-5 md:px-6 lg:px-8';

/** Top inset below the sticky top bar — keep tight and consistent on every page. */
export const DASHBOARD_MAIN_PADDING_TOP = 'pt-4 sm:pt-5';

/** Bottom scroll padding for long pages. */
export const DASHBOARD_MAIN_PADDING_BOTTOM = 'pb-6 sm:pb-8 lg:pb-10';

/** @deprecated Use DASHBOARD_MAIN_PADDING_TOP + DASHBOARD_MAIN_PADDING_BOTTOM */
export const DASHBOARD_MAIN_VERTICAL = `${DASHBOARD_MAIN_PADDING_TOP} ${DASHBOARD_MAIN_PADDING_BOTTOM}`;

/** Standard page wrapper — flex column with uniform section gaps. */
export const DASHBOARD_PAGE_SHELL_CLASS = 'page-shell';

/** Standard page title row below the top bar. */
export const DASHBOARD_PAGE_HEADER_CLASS = 'page-header';

/** Glass card shell — use on tables, forms, and content panels across dashboard routes. */
export const DASHBOARD_SURFACE_CLASS = 'dashboard-surface';

/** Compact KPI / stat tile on list and overview pages. */
export const DASHBOARD_STAT_CARD_CLASS = 'dashboard-stat-card';

/** Toolbar strip above tables (filters, search). */
export const DASHBOARD_TOOLBAR_CLASS = 'dashboard-toolbar';

/** Classes for every dashboard data table — enables zebra striping + alignment. */
export const DASHBOARD_DATA_TABLE_CLASS = 'data-table dashboard-data-table';

/** Optional row class when tbody has non-data rows (expandable details) between entries. */
export function dashboardTableStripeClass(rowIndex: number): string {
  const pos = rowIndex % 4;
  if (pos === 1) return 'table-stripe-primary';
  if (pos === 3) return 'table-stripe-secondary';
  return '';
}
