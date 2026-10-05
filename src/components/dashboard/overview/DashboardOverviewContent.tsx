'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronRight,
  Clock,
  Pin,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { DashboardTodayHome, type TodayStat } from '@/components/dashboard/overview/DashboardTodayHome';
import { useEntity } from '@/components/EntitySwitcher';
import { useDashboardSession } from '@/contexts/dashboard-session';
import type { OverviewCoreMetrics } from '@/lib/dashboard-overview-metrics';
import { readOverviewCoreCache, writeOverviewCoreCache } from '@/lib/dashboard-overview-cache';
import {
  ALL_MODULES_ENABLED,
  buildDashboardNavSections,
  resolveDashboardNavItems,
} from '@/lib/dashboard-nav-catalog';
import {
  buildAttentionItems,
  buildCrossModuleKpis,
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
  type OverviewCrossModuleMetrics,
  type OverviewShortcut,
} from '@/lib/dashboard-overview-personalization';
import { useDashboardModuleOrder } from '@/contexts/dashboard-module-order';
import {
  FULL_WIDTH_OVERVIEW_WIDGETS,
  orderKpisByLayout,
  resolveWidgetOrder,
  SIDEBAR_OVERVIEW_WIDGETS,
  type OverviewWidgetId,
} from '@/lib/dashboard-overview-layout';
import { useDashboardOverviewLayout } from '@/contexts/dashboard-overview-layout';
import { DemoWalkthroughCard } from '@/components/dashboard/DemoWalkthroughCard';
import { isPublicDemoMode } from '@/lib/deployment-flags';


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
    assetsAssigned: data.crossModule.assetsAssigned ?? 0,
    assetsPendingHandoverAck: data.crossModule.assetsPendingHandoverAck ?? 0,
    assetsWarrantyExpiring: data.crossModule.assetsWarrantyExpiring ?? 0,
    openHseIncidents: data.crossModule.openHseIncidents ?? 0,
    openHseActions: data.crossModule.openHseActions ?? 0,
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

    const loadHomePaint = async () => {
      if (!hasWarmCore) setCoreLoading(true);
      try {
        const res = await fetch('/api/dashboard/overview?metricsOnly=1&slice=home', {
          credentials: 'include',
        });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as OverviewCoreMetrics;
        if (cancelled) return;
        // First paint: clear the hero stats skeleton with the trimmed home slice.
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
      } finally {
        if (!cancelled) setCoreLoading(false);
      }
    };

    const loadFullCore = async () => {
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
        // Attention badge is written once full metrics land (includes cross-module queues).
        const personaNow = resolveOverviewPersona(sessionUser);
        const attentionTotal = buildAttentionItems({
          pendingLeave: data.pendingApprovals,
          openAttendanceExceptions: data.openAttendanceExceptions,
          credentialsExpiring: data.credentialsExpiring,
          credentialsExpired: data.credentialsExpired,
          myOnboardingCount: 0,
          unreadNotifications: data.unreadNotifications,
          crossModule: data.crossModule,
          persona: personaNow,
          modules: sessionModules ?? ALL_MODULES_ENABLED,
        }).length;
        writeOverviewCoreCache(sessionUser.currentOrgId!, activeEntity.id, data, attentionTotal);
      } catch {
        // Full core is best-effort after home paint.
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

    void loadHomePaint().then(() => {
      if (!cancelled) void loadFullCore();
    });
    void loadPinnedNav();
    if (sessionUser?.currentOrgId && bootstrapOverviewCore) {
      const personaNow = resolveOverviewPersona(sessionUser);
      const attentionTotal = buildAttentionItems({
        pendingLeave: bootstrapOverviewCore.pendingApprovals,
        openAttendanceExceptions: bootstrapOverviewCore.openAttendanceExceptions,
        credentialsExpiring: bootstrapOverviewCore.credentialsExpiring,
        credentialsExpired: bootstrapOverviewCore.credentialsExpired,
        myOnboardingCount: 0,
        unreadNotifications: bootstrapOverviewCore.unreadNotifications,
        crossModule: bootstrapOverviewCore.crossModule,
        persona: personaNow,
        modules: sessionModules ?? ALL_MODULES_ENABLED,
      }).length;
      writeOverviewCoreCache(
        sessionUser.currentOrgId,
        activeEntity.id,
        bootstrapOverviewCore,
        attentionTotal,
      );
    }

    return () => {
      cancelled = true;
    };
  }, [sessionUser, activeEntity.id, bootstrapOverviewCore, sessionModules]);

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

  const snapshotKpis = useMemo(() => {
    if (coreLoading) return [];
    const kpis = buildCrossModuleKpis({
      totalStaff,
      onDuty,
      pendingLeave: pendingApprovals,
      credentialsExpiring,
      credentialsExpired,
      crossModule,
      persona,
      modules,
    }).filter((kpi) => kpi.show);

    return orderKpisByLayout(kpis, layout);
  }, [
    coreLoading,
    totalStaff,
    onDuty,
    pendingApprovals,
    credentialsExpiring,
    credentialsExpired,
    crossModule,
    persona,
    modules,
    layout,
  ]);

  const personalPlanningHidden = (layout.hiddenWidgets ?? []).includes('personal-planning');

  const eligibleFullWidthWidgets = useMemo(() => {
    const ids: OverviewWidgetId[] = [];
    if (!personalPlanningHidden) ids.push('personal-planning');
    // Standalone attention only when Getting into work is hidden (otherwise it's folded in).
    if (!coreLoading && attentionItems.length > 0 && personalPlanningHidden) ids.push('attention');
    if (!coreLoading && snapshotKpis.length > 0) ids.push('snapshot');
    ids.push('command-center');
    return ids;
  }, [coreLoading, attentionItems.length, snapshotKpis.length, personalPlanningHidden]);

  const orderedFullWidthWidgets = useMemo(
    () => resolveWidgetOrder(eligibleFullWidthWidgets, layout, FULL_WIDTH_OVERVIEW_WIDGETS),
    [eligibleFullWidthWidgets, layout],
  );

  const eligibleSidebarWidgets = useMemo(() => {
    const ids: OverviewWidgetId[] = ['shortcuts'];
    // Inbox lives inside Getting into work; only surface the standalone Updates panel if that widget is hidden.
    if (!coreLoading && personalPlanningHidden) ids.push('notifications');
    return ids;
  }, [coreLoading, personalPlanningHidden]);

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

  const todayStats: TodayStat[] = [
    {
      label: 'Team',
      value: totalStaff,
      caption: `${onDuty} on duty today`,
      href: '/dashboard/employees',
      icon: Users,
    },
    {
      label: 'Approvals waiting',
      value: pendingApprovals,
      caption: pendingApprovals === 1 ? 'Leave request to review' : 'Leave requests to review',
      href: '/dashboard/leave',
      icon: CalendarClock,
      tone: 'attention',
    },
    {
      label: 'Attendance exceptions',
      value: openAttendanceExceptions,
      caption: 'Open today',
      href: '/dashboard/attendance',
      icon: Clock,
      tone: 'attention',
    },
    crossModule.hasFinanceClient
      ? {
          label: 'Unpaid invoices',
          value: crossModule.invoicesOutstanding,
          caption: 'Awaiting payment',
          href: '/dashboard/accounts',
          icon: Receipt,
          tone: 'attention' as const,
        }
      : {
          label: 'Credentials expiring',
          value: credentialsExpiring + credentialsExpired,
          caption: credentialsExpired > 0 ? `${credentialsExpired} already expired` : 'In the next 30 days',
          href: '/dashboard/employees',
          icon: ShieldCheck,
          tone: 'attention' as const,
        },
  ];

  return (
    <>
      {isPublicDemoMode() ? (
        <div className="page-shell pb-0">
          <DemoWalkthroughCard />
        </div>
      ) : null}
      <DashboardTodayHome
        greeting={greeting}
        dateLabel={todayLabel}
        entityName={activeEntity.name}
        roleLabel={roleLabel}
        subtitle={subtitle}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        stats={todayStats}
        attentionItems={!coreLoading ? attentionItems : []}
        shortcuts={shortcuts}
        businessKpis={snapshotKpis}
        loading={coreLoading}
      />
    </>
  );
}
