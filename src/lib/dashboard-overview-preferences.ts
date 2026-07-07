import { prisma } from '@/lib/prisma';

export {
  DEFAULT_OVERVIEW_LAYOUT,
  FULL_WIDTH_OVERVIEW_WIDGETS,
  OVERVIEW_WIDGET_IDS,
  SIDEBAR_OVERVIEW_WIDGETS,
  isLayoutCustomized,
  isOverviewWidgetId,
  orderKpisByLayout,
  parseDashboardOverviewLayout,
  parseOverviewKpiIds,
  parseOverviewWidgetIds,
  resolveWidgetOrder,
  sanitizeDashboardOverviewLayout,
  toggleKpiPin,
  toggleWidgetHidden,
  toggleWidgetPin,
  type DashboardOverviewLayout,
  type OverviewWidgetId,
} from '@/lib/dashboard-overview-layout';

import {
  DEFAULT_OVERVIEW_LAYOUT,
  parseDashboardOverviewLayout,
  sanitizeDashboardOverviewLayout,
  type DashboardOverviewLayout,
} from '@/lib/dashboard-overview-layout';

export async function getUserDashboardOverviewLayout(userId: string): Promise<DashboardOverviewLayout> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardOverviewLayout: true },
  });
  return sanitizeDashboardOverviewLayout(parseDashboardOverviewLayout(user?.dashboardOverviewLayout));
}

export async function setUserDashboardOverviewLayout(
  userId: string,
  layout: DashboardOverviewLayout,
): Promise<DashboardOverviewLayout> {
  const sanitized = sanitizeDashboardOverviewLayout(layout);
  await prisma.user.update({
    where: { id: userId },
    data: { dashboardOverviewLayout: sanitized },
  });
  return sanitized;
}

export async function clearUserDashboardOverviewLayout(userId: string): Promise<DashboardOverviewLayout> {
  await prisma.user.update({
    where: { id: userId },
    data: { dashboardOverviewLayout: null },
  });
  return { ...DEFAULT_OVERVIEW_LAYOUT };
}
