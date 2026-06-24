import { prisma } from '@/lib/prisma';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { isDashboardModuleDomainId } from '@/lib/dashboard-module-preferences';

export const OVERVIEW_WIDGET_IDS = [
  'command-center',
  'attention',
  'snapshot',
  'hr-details',
  'shortcuts',
  'notifications',
  'credentials',
] as const;

export type OverviewWidgetId = (typeof OVERVIEW_WIDGET_IDS)[number];

const WIDGET_ID_SET = new Set<OverviewWidgetId>(OVERVIEW_WIDGET_IDS);

export type DashboardOverviewLayout = {
  pinnedWidgets?: OverviewWidgetId[];
  hiddenWidgets?: OverviewWidgetId[];
  pinnedKpis?: DashboardModuleDomainId[];
  hiddenKpis?: DashboardModuleDomainId[];
};

export const DEFAULT_OVERVIEW_LAYOUT: DashboardOverviewLayout = {
  pinnedWidgets: [],
  hiddenWidgets: [],
  pinnedKpis: [],
  hiddenKpis: [],
};

export const FULL_WIDTH_OVERVIEW_WIDGETS: OverviewWidgetId[] = [
  'command-center',
  'attention',
  'snapshot',
];

export const SIDEBAR_OVERVIEW_WIDGETS: OverviewWidgetId[] = [
  'shortcuts',
  'notifications',
  'credentials',
];

export function isOverviewWidgetId(value: string): value is OverviewWidgetId {
  return WIDGET_ID_SET.has(value as OverviewWidgetId);
}

export function parseOverviewWidgetIds(value: unknown): OverviewWidgetId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<OverviewWidgetId>();
  const result: OverviewWidgetId[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !isOverviewWidgetId(entry)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

export function parseOverviewKpiIds(value: unknown): DashboardModuleDomainId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<DashboardModuleDomainId>();
  const result: DashboardModuleDomainId[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !isDashboardModuleDomainId(entry)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

export function parseDashboardOverviewLayout(value: unknown): DashboardOverviewLayout {
  if (!value || typeof value !== 'object') return { ...DEFAULT_OVERVIEW_LAYOUT };
  const raw = value as Record<string, unknown>;
  return {
    pinnedWidgets: parseOverviewWidgetIds(raw.pinnedWidgets),
    hiddenWidgets: parseOverviewWidgetIds(raw.hiddenWidgets),
    pinnedKpis: parseOverviewKpiIds(raw.pinnedKpis),
    hiddenKpis: parseOverviewKpiIds(raw.hiddenKpis),
  };
}

export function sanitizeDashboardOverviewLayout(
  layout: DashboardOverviewLayout,
): DashboardOverviewLayout {
  return {
    pinnedWidgets: parseOverviewWidgetIds(layout.pinnedWidgets),
    hiddenWidgets: parseOverviewWidgetIds(layout.hiddenWidgets),
    pinnedKpis: parseOverviewKpiIds(layout.pinnedKpis),
    hiddenKpis: parseOverviewKpiIds(layout.hiddenKpis),
  };
}

/** Pinned first, then remaining eligible widgets in canonical order. Hidden widgets omitted. */
export function resolveWidgetOrder(
  eligible: OverviewWidgetId[],
  layout: DashboardOverviewLayout,
  canonical: OverviewWidgetId[],
): OverviewWidgetId[] {
  const hidden = new Set(layout.hiddenWidgets ?? []);
  const pinned = layout.pinnedWidgets ?? [];
  const available = eligible.filter((id) => !hidden.has(id));
  const pinnedSet = new Set(pinned);
  const pinnedVisible = pinned.filter((id) => available.includes(id));
  const unpinned = canonical.filter((id) => available.includes(id) && !pinnedSet.has(id));
  return [...pinnedVisible, ...unpinned];
}

export function orderKpisByLayout<T extends { domainId: DashboardModuleDomainId }>(
  items: T[],
  layout: DashboardOverviewLayout,
): T[] {
  const hidden = new Set(layout.hiddenKpis ?? []);
  const visible = items.filter((item) => !hidden.has(item.domainId));
  const pinned = layout.pinnedKpis ?? [];
  if (pinned.length === 0) return visible;

  const pinnedSet = new Set(pinned);
  const pinnedItems = pinned
    .map((id) => visible.find((item) => item.domainId === id))
    .filter((item): item is T => Boolean(item));
  const unpinned = visible.filter((item) => !pinnedSet.has(item.domainId));
  return [...pinnedItems, ...unpinned];
}

export function isLayoutCustomized(layout: DashboardOverviewLayout): boolean {
  return (
    (layout.pinnedWidgets?.length ?? 0) > 0 ||
    (layout.hiddenWidgets?.length ?? 0) > 0 ||
    (layout.pinnedKpis?.length ?? 0) > 0 ||
    (layout.hiddenKpis?.length ?? 0) > 0
  );
}

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

export function toggleWidgetPin(
  layout: DashboardOverviewLayout,
  widgetId: OverviewWidgetId,
): DashboardOverviewLayout {
  const pinned = [...(layout.pinnedWidgets ?? [])];
  const hidden = [...(layout.hiddenWidgets ?? [])];
  const index = pinned.indexOf(widgetId);
  if (index >= 0) {
    pinned.splice(index, 1);
  } else {
    pinned.push(widgetId);
    const hiddenIndex = hidden.indexOf(widgetId);
    if (hiddenIndex >= 0) hidden.splice(hiddenIndex, 1);
  }
  return sanitizeDashboardOverviewLayout({ ...layout, pinnedWidgets: pinned, hiddenWidgets: hidden });
}

export function toggleWidgetHidden(
  layout: DashboardOverviewLayout,
  widgetId: OverviewWidgetId,
): DashboardOverviewLayout {
  const hidden = [...(layout.hiddenWidgets ?? [])];
  const pinned = [...(layout.pinnedWidgets ?? [])];
  const index = hidden.indexOf(widgetId);
  if (index >= 0) {
    hidden.splice(index, 1);
  } else {
    hidden.push(widgetId);
    const pinnedIndex = pinned.indexOf(widgetId);
    if (pinnedIndex >= 0) pinned.splice(pinnedIndex, 1);
  }
  return sanitizeDashboardOverviewLayout({ ...layout, hiddenWidgets: hidden, pinnedWidgets: pinned });
}

export function toggleKpiPin(
  layout: DashboardOverviewLayout,
  domainId: DashboardModuleDomainId,
): DashboardOverviewLayout {
  const pinned = [...(layout.pinnedKpis ?? [])];
  const hidden = [...(layout.hiddenKpis ?? [])];
  const index = pinned.indexOf(domainId);
  if (index >= 0) {
    pinned.splice(index, 1);
  } else {
    pinned.push(domainId);
    const hiddenIndex = hidden.indexOf(domainId);
    if (hiddenIndex >= 0) hidden.splice(hiddenIndex, 1);
  }
  return sanitizeDashboardOverviewLayout({ ...layout, pinnedKpis: pinned, hiddenKpis: hidden });
}
