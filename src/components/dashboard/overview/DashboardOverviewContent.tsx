'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  ChevronRight,
  Pin,
} from 'lucide-react';
import { useEntity } from '@/components/EntitySwitcher';
import { useDashboardSession } from '@/contexts/dashboard-session';
import type { OverviewCoreMetrics } from '@/lib/dashboard-overview-metrics';
import { readOverviewCoreCache, writeOverviewCoreCache } from '@/lib/dashboard-overview-cache';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  ALL_MODULES_ENABLED,
  buildDashboardNavSections,
  resolveDashboardNavItems,
} from '@/lib/dashboard-nav-catalog';
import {
  buildAttentionItems,
  buildDefaultShortcuts,
  buildDomainSnapshots,
  getOverviewGreeting,
  getOverviewPrimaryAction,
  getOverviewRoleLabel,
  getOverviewSecondaryAction,
  getOverviewSubtitle,
  groupAttentionByDomain,
  pickTopAttentionAction,
  resolveOverviewPersona,
  type OverviewAttentionItem,
  type OverviewCrossModuleMetrics,
  type OverviewShortcut,
} from '@/lib/dashboard-overview-personalization';
import { useDashboardModuleOrder } from '@/contexts/dashboard-module-order';
import { OverviewModuleCommandCenter } from '@/components/dashboard/overview/OverviewModuleCommandCenter';
import {
  FULL_WIDTH_OVERVIEW_WIDGETS,
  resolveWidgetOrder,
  SIDEBAR_OVERVIEW_WIDGETS,
  type OverviewWidgetId,
} from '@/lib/dashboard-overview-layout';
import { useDashboardOverviewLayout } from '@/contexts/dashboard-overview-layout';
import { OverviewWidgetHeader } from '@/components/dashboard/overview/OverviewWidgetHeader';
import { DemoWalkthroughCard } from '@/components/dashboard/DemoWalkthroughCard';
import { isPublicDemoMode } from '@/lib/deployment-flags';
import type { ModuleKey } from '@/lib/modules';

const ALL_MODULES_ON: Record<ModuleKey, boolean> = {
  core: true,
  leave: true,
  time: true,
  payroll: true,
  ats: true,
  performance: true,
  hse: true,
  accounts: true,
  disciplinary: true,
  reports: true,
  assets: true,
  ess: true,
  communications: true,
  training: true,
  documents: true,
};

function attentionRowClass(tone: OverviewAttentionItem['tone']) {
  if (tone === 'amber') return 'dash-overview-attention-row--amber';
  if (tone === 'rose') return 'dash-overview-attention-row--rose';
  if (tone === 'sky') return 'dash-overview-attention-row--sky';
  return 'dash-overview-attention-row--neutral';
}

function ShortcutTile({ item, pinned = false }: { item: OverviewShortcut; pinned?: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="dash-overview-row-link group">
      <span className="dash-icon-well flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-[var(--dash-text-strong)]">{item.label}</p>
          {pinned ? <Pin className="h-3 w-3 shrink-0 text-[var(--dash-text-subtle)]" aria-label="Pinned" /> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--dash-text-muted)]">{item.desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dash-text-faint)] transition group-hover:text-[var(--dash-text-muted)]" />
    </Link>
  );
}

function applyOverviewCoreMetrics(
  data: OverviewCoreMetrics,
  setters: {
    setTotalStaff: (v: number) => void;
    setOnDuty: (v: number) => void;
    setPendingApprovals: (v: number) => void;
    setOpenAttendanceExceptions: (v: number) => void;
    setCredentialsExpiring: (v: number) => void;
    setCredentialsExpired: (v: number) => void;
    setUnreadNotifications: (v: number) => void;
    setCrossModule: (v: OverviewCrossModuleMetrics) => void;
  },
) {
  setters.setTotalStaff(data.totalStaff);
  setters.setOnDuty(data.onDuty);
  setters.setPendingApprovals(data.pendingApprovals);
  setters.setOpenAttendanceExceptions(data.openAttendanceExceptions);
  setters.setCredentialsExpiring(data.credentialsExpiring);
  setters.setCredentialsExpired(data.credentialsExpired);
  setters.setUnreadNotifications(data.unreadNotifications);
  setters.setCrossModule({
    invoicesOutstanding: data.crossModule.invoicesOutstanding,
    vendorBillsOutstanding: data.crossModule.vendorBillsOutstanding,
    activeFleetTrips: data.crossModule.activeFleetTrips,
    openFleetIncidents: data.crossModule.openFleetIncidents,
    pendingPurchaseRequests: data.crossModule.pendingPurchaseRequests,
    hasFinanceClient: data.crossModule.hasFinanceClient,
    salesStalledDeals: data.crossModule.salesStalledDeals ?? 0,
    salesPastDueCloses: data.crossModule.salesPastDueCloses ?? 0,
    salesClosingThisWeek: data.crossModule.salesClosingThisWeek ?? 0,
    salesWeightedPipelineKes: data.crossModule.salesWeightedPipelineKes ?? 0,
  });
}

export default function DashboardOverviewContent() {
  const {
    user: sessionUser,
    modules: sessionModules,
    overviewCore: bootstrapOverviewCore,
  } = useDashboardSession();
  const { visibleDomains } = useDashboardModuleOrder();
  const { activeEntity } = useEntity();
  const [coreLoading, setCoreLoading] = useState(() => bootstrapOverviewCore == null);
  const [totalStaff, setTotalStaff] = useState(0);
  const [onDuty, setOnDuty] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [openAttendanceExceptions, setOpenAttendanceExceptions] = useState(0);
  const [credentialsExpiring, setCredentialsExpiring] = useState(0);
  const [credentialsExpired, setCredentialsExpired] = useState(0);
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [crossModule, setCrossModule] = useState<OverviewCrossModuleMetrics>({
    invoicesOutstanding: 0,
    vendorBillsOutstanding: 0,
    activeFleetTrips: 0,
    openFleetIncidents: 0,
    pendingPurchaseRequests: 0,
    salesStalledDeals: 0,
    salesPastDueCloses: 0,
    salesClosingThisWeek: 0,
    salesWeightedPipelineKes: 0,
    assetsAssigned: 0,
    assetsPendingHandoverAck: 0,
    assetsWarrantyExpiring: 0,
    openHseIncidents: 0,
    openHseActions: 0,
  });

  useLayoutEffect(() => {
    const seed = bootstrapOverviewCore
      ?? (sessionUser?.currentOrgId
        ? readOverviewCoreCache(sessionUser.currentOrgId, activeEntity.id)
        : null);
    if (!seed) return;
    applyOverviewCoreMetrics(seed, {
      setTotalStaff,
      setOnDuty,
      setPendingApprovals,
      setOpenAttendanceExceptions,
      setCredentialsExpiring,
      setCredentialsExpired,
      setUnreadNotifications,
      setCrossModule,
    });
    setCoreLoading(false);
  }, [bootstrapOverviewCore, sessionUser?.currentOrgId, activeEntity.id]);

  useEffect(() => {
    if (!sessionUser?.currentOrgId) {
      // Avoid an infinite skeleton if bootstrap fails or never yields a session.
      setCoreLoading(false);
      return;
    }

    let cancelled = false;
    const hasWarmCore = Boolean(
      bootstrapOverviewCore
        || readOverviewCoreCache(sessionUser.currentOrgId, activeEntity.id),
    );

    const loadCore = async () => {
      if (!hasWarmCore) setCoreLoading(true);
      try {
        const res = await fetch('/api/dashboard/overview?metricsOnly=1&slice=core', {
          credentials: 'include',
        });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as OverviewCoreMetrics;
        if (cancelled) return;
        applyOverviewCoreMetrics(data, {
          setTotalStaff,
          setOnDuty,
          setPendingApprovals,
          setOpenAttendanceExceptions,
          setCredentialsExpiring,
          setCredentialsExpired,
          setUnreadNotifications,
          setCrossModule,
        });
        writeOverviewCoreCache(sessionUser.currentOrgId!, activeEntity.id, data);
      } finally {
        if (!cancelled) setCoreLoading(false);
      }
    };

    const loadPinnedNav = async () => {
      try {
        const res = await fetch('/api/dashboard/nav-preferences', { credentials: 'include' });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { pinned?: string[] };
        if (cancelled) return;
        setPinnedHrefs(Array.isArray(data.pinned) ? data.pinned : []);
      } catch {
        // Pinned shortcuts are optional on the home overview.
      }
    };

    void Promise.all([loadCore(), loadPinnedNav()]);
    if (sessionUser?.currentOrgId && bootstrapOverviewCore) {
      writeOverviewCoreCache(sessionUser.currentOrgId, activeEntity.id, bootstrapOverviewCore);
    }

    return () => {
      cancelled = true;
    };
  }, [sessionUser?.currentOrgId, activeEntity.id, bootstrapOverviewCore]);

  const me = sessionUser;
  const modules = sessionModules;
  const persona = useMemo(() => resolveOverviewPersona(me), [me]);

  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    );
  }, []);

  const navSections = useMemo(
    () =>
      buildDashboardNavSections({
        currentUserRole: me?.role ?? null,
        hasAccountsAccess: me?.hasAccountsAccess ?? false,
        canViewSystemAnalytics: me?.canViewSystemAnalytics ?? false,
        enabledModules: modules ?? ALL_MODULES_ENABLED,
      }),
    [me, modules],
  );

  const pinnedShortcuts = useMemo(() => {
    const items = resolveDashboardNavItems(pinnedHrefs, navSections);
    return items.map((item) => ({
      href: item.href,
      label: item.label,
      desc: 'Pinned shortcut',
      icon: item.icon,
    }));
  }, [pinnedHrefs, navSections]);

  const defaultShortcuts = useMemo(
    () => buildDefaultShortcuts(me, persona, modules),
    [me, persona, modules],
  );

  const shortcuts = useMemo(() => {
    const seen = new Set<string>();
    const merged: OverviewShortcut[] = [];
    for (const item of [...pinnedShortcuts, ...defaultShortcuts]) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      merged.push(item);
      if (merged.length >= 6) break;
    }
    return merged;
  }, [pinnedShortcuts, defaultShortcuts]);

  const pinnedHrefSet = useMemo(() => new Set(pinnedHrefs), [pinnedHrefs]);

  const attentionItems = useMemo(
    () =>
      buildAttentionItems({
        pendingLeave: pendingApprovals,
        openAttendanceExceptions,
        credentialsExpiring,
        credentialsExpired,
        myOnboardingCount: 0,
        unreadNotifications,
        crossModule,
        persona,
        modules,
      }),
    [
      pendingApprovals,
      openAttendanceExceptions,
      credentialsExpiring,
      credentialsExpired,
      unreadNotifications,
      crossModule,
      persona,
      modules,
    ],
  );

  const domainSnapshots = useMemo(
    () =>
      buildDomainSnapshots({
        totalStaff,
        pendingLeave: pendingApprovals,
        onDuty,
        credentialsExpiring,
        credentialsExpired,
        crossModule,
        modules,
      }),
    [
      totalStaff,
      pendingApprovals,
      onDuty,
      credentialsExpiring,
      credentialsExpired,
      crossModule,
      modules,
    ],
  );

  const attentionByDomain = useMemo(() => groupAttentionByDomain(attentionItems), [attentionItems]);

  const primaryAction = useMemo(() => {
    const urgent = pickTopAttentionAction(attentionItems);
    if (urgent) return urgent;
    return getOverviewPrimaryAction(me, persona, pendingApprovals);
  }, [attentionItems, me, persona, pendingApprovals]);
  const secondaryAction = useMemo(
    () => getOverviewSecondaryAction(me, persona, modules ?? {}),
    [me, persona, modules],
  );

  const greeting = getOverviewGreeting(me?.name ?? '', me?.email);
  const roleLabel = getOverviewRoleLabel(me);
  const subtitle = getOverviewSubtitle(persona);

  const headerActions = useMemo(() => {
    const items = [
      {
        href: primaryAction.href,
        label: primaryAction.label,
        icon: primaryAction.icon,
        variant: primaryAction.variant,
      },
    ];
    if (secondaryAction) {
      items.push({
        href: secondaryAction.href,
        label: secondaryAction.label,
        icon: secondaryAction.icon,
        variant: secondaryAction.variant,
      });
    }
    return items;
  }, [primaryAction, secondaryAction]);

  const { layout, isCustom } = useDashboardOverviewLayout();

  const eligibleFullWidthWidgets = useMemo(() => {
    const ids: OverviewWidgetId[] = [];
    if (!coreLoading && attentionItems.length > 0) ids.push('attention');
    ids.push('command-center');
    return ids;
  }, [coreLoading, attentionItems.length]);

  const orderedFullWidthWidgets = useMemo(
    () => resolveWidgetOrder(eligibleFullWidthWidgets, layout, FULL_WIDTH_OVERVIEW_WIDGETS),
    [eligibleFullWidthWidgets, layout],
  );

  const eligibleSidebarWidgets = useMemo(() => {
    const ids: OverviewWidgetId[] = ['shortcuts'];
    if (!coreLoading) ids.push('notifications');
    return ids;
  }, [coreLoading]);

  const orderedSidebarWidgets = useMemo(
    () => resolveWidgetOrder(eligibleSidebarWidgets, layout, SIDEBAR_OVERVIEW_WIDGETS),
    [eligibleSidebarWidgets, layout],
  );

  if (!me) {
    return (
      <div className="page-shell space-y-6">
        <div className="skeleton h-36 rounded-2xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardPageHeader
        variant="hero"
        badges={[
          { label: roleLabel },
          { label: activeEntity.name, icon: Building2 },
        ]}
        title={greeting}
        description={subtitle}
        meta={todayLabel || undefined}
        actions={headerActions}
        titleSuppressHydrationWarning
        metaSuppressHydrationWarning
      />

      {isPublicDemoMode() ? <DemoWalkthroughCard /> : null}

      {isCustom ? (
        <p className="text-xs text-[var(--dash-text-subtle)]">
          Your personalized dashboard layout.{' '}
          <Link href="/dashboard/settings#dashboard-layout" className="font-medium text-primary-700 hover:text-primary-800">
            Manage in Settings
          </Link>
        </p>
      ) : null}

      {orderedFullWidthWidgets.includes('attention') && !coreLoading && attentionItems.length > 0 ? (
        <section className="dashboard-panel group/pin-target overflow-hidden">
          <OverviewWidgetHeader
            widgetId="attention"
            title="Needs attention now"
            trailing={
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                {attentionItems.length}
              </span>
            }
          />
          <div className="space-y-4 px-2 py-2 sm:px-3">
            {visibleDomains.filter((d) => (attentionByDomain[d.id]?.length ?? 0) > 0).map(
              (domain) => {
                const items = attentionByDomain[domain.id] ?? [];
                const DomainIcon = domain.icon;
                return (
                  <div key={domain.id}>
                    <div className="mb-1.5 flex items-center gap-2 px-1">
                      <DomainIcon className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]">
                        {domain.shortLabel}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      {items.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`dash-overview-attention-row group ${attentionRowClass(item.tone)}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--dash-text-strong)]">{item.label}</p>
                            <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">{item.detail}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--dash-text-faint)] transition group-hover:text-[var(--dash-text-muted)]" />
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </section>
      ) : null}

      {orderedFullWidthWidgets.includes('command-center') ? (
        coreLoading ? (
          <div className="skeleton h-44 rounded-xl" aria-hidden />
        ) : (
          <OverviewModuleCommandCenter
            attentionByDomain={attentionByDomain}
            domainSnapshots={domainSnapshots}
          />
        )
      ) : null}

      {orderedSidebarWidgets.length > 0 ? (
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <aside className="space-y-6 xl:col-span-12">
          {orderedSidebarWidgets.includes('shortcuts') ? (
          <div className="dashboard-panel group/pin-target overflow-hidden">
            <OverviewWidgetHeader
              widgetId="shortcuts"
              title="Jump to a module"
              trailing={
                pinnedShortcuts.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dash-text-subtle)]">
                    <Pin className="h-3 w-3" /> Pinned first
                  </span>
                ) : null
              }
            />
            <div className="space-y-0.5 px-2 pb-3 pt-1 sm:px-3">
              {shortcuts.map((item) => (
                <ShortcutTile key={item.href} item={item} pinned={pinnedHrefSet.has(item.href)} />
              ))}
            </div>
            <p className="border-t border-[var(--dash-border-subtle)] px-4 py-2.5 text-[11px] leading-relaxed text-[var(--dash-text-subtle)] sm:px-5">
              Pin any sidebar link to surface it here — hover a nav item and click the pin icon.
            </p>
          </div>
          ) : null}

          {orderedSidebarWidgets.includes('notifications') ? (
          <div className="dashboard-panel group/pin-target overflow-hidden">
            <OverviewWidgetHeader
              widgetId="notifications"
              title="Updates"
              trailing={
                unreadNotifications > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                    <Bell className="h-3 w-3" />
                    {unreadNotifications}
                  </span>
                ) : null
              }
            />
            <div className="px-4 py-5 text-center sm:px-5">
              <p className="text-sm text-[var(--dash-text-muted)]">
                {unreadNotifications > 0
                  ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}.`
                  : 'You’re caught up.'}
              </p>
              <Link
                href="/dashboard/notifications"
                className="mt-2 inline-flex text-sm font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400"
              >
                Open notifications →
              </Link>
            </div>
          </div>
          ) : null}
        </aside>
      </section>
      ) : null}
    </div>
  );
}
