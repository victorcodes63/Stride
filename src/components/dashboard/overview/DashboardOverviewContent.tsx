'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  ChevronRight,
  Clock,
  Pin,
  type LucideIcon,
} from 'lucide-react';
import { useEntity } from '@/components/EntitySwitcher';
import { useDashboardSession } from '@/contexts/dashboard-session';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
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
  shouldExpandHrDetails,
  shouldShowPayrollBlock,
  type OverviewAttentionItem,
  type OverviewCrossModuleMetrics,
  type OverviewShortcut,
} from '@/lib/dashboard-overview-personalization';
import { useDashboardModuleOrder } from '@/contexts/dashboard-module-order';
import { OverviewModuleCommandCenter } from '@/components/dashboard/overview/OverviewModuleCommandCenter';
import {
  FULL_WIDTH_OVERVIEW_WIDGETS,
  orderKpisByLayout,
  resolveWidgetOrder,
  SIDEBAR_OVERVIEW_WIDGETS,
  type OverviewWidgetId,
} from '@/lib/dashboard-overview-preferences';
import { useDashboardOverviewLayout } from '@/contexts/dashboard-overview-layout';
import { OverviewKpiMiniChart } from '@/components/dashboard/overview/OverviewKpiMiniChart';
import type { OverviewKpiChartSegment } from '@/lib/dashboard-overview-personalization';
import { OverviewWidgetHeader } from '@/components/dashboard/overview/OverviewWidgetHeader';
import { OverviewPinButton } from '@/components/dashboard/overview/OverviewPinButton';
import { DemoWalkthroughCard } from '@/components/dashboard/DemoWalkthroughCard';
import { isPublicDemoMode } from '@/lib/deployment-config';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import type { ModuleKey } from '@/lib/modules';
import type { UserSummary } from '@/types/dashboard';

type AttendanceRow = {
  id: string;
  employee?: { firstName?: string; lastName?: string };
  workDate: string;
  firstInAt?: string | null;
  lateMinutes?: number;
};

type MyTaskRow = {
  id: string;
  title: string;
  dueDate?: string | null;
  status: string;
  workflow: { employee: { firstName: string; lastName: string } };
};

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  unread: boolean;
  createdAt: string;
};

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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(currency === 'UGX' ? 'en-UG' : 'en-KE', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'UGX' ? 0 : 2,
      maximumFractionDigits: currency === 'UGX' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function attentionRowClass(tone: OverviewAttentionItem['tone']) {
  if (tone === 'amber') return 'dash-overview-attention-row--amber';
  if (tone === 'rose') return 'dash-overview-attention-row--rose';
  if (tone === 'sky') return 'dash-overview-attention-row--sky';
  return 'dash-overview-attention-row--neutral';
}

function OverviewPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`dashboard-panel ${className}`}>
      <div className="dashboard-panel-header flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-secondary-800">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function OverviewPanelFlush({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-secondary-800">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-36 rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="skeleton h-80 rounded-xl xl:col-span-8" />
        <div className="skeleton h-80 rounded-xl xl:col-span-4" />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  href,
  chartSegments,
  chartPlaceholder = false,
  domainId,
}: {
  label: string;
  value: number | string;
  note: string;
  icon: LucideIcon;
  href?: string;
  chartSegments: OverviewKpiChartSegment[];
  chartPlaceholder?: boolean;
  domainId: DashboardModuleDomainId;
}) {
  const { isKpiPinned, toggleKpiPin } = useDashboardOverviewLayout();
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-muted)]">{label}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <OverviewPinButton
            isPinned={isKpiPinned(domainId)}
            label={label}
            onToggle={() => void toggleKpiPin(domainId)}
            className="opacity-100"
          />
          {href ? <ArrowUpRight className="h-3.5 w-3.5 text-[var(--dash-text-faint)] transition group-hover:text-primary-500" aria-hidden /> : null}
        </div>
      </div>
      <OverviewKpiMiniChart segments={chartSegments} placeholder={chartPlaceholder} />
      <div className="mt-2 flex items-baseline gap-1.5">
        {!chartPlaceholder ? (
          <p className="dash-overview-kpi-value text-lg font-semibold leading-none tracking-tight tabular-nums text-[var(--dash-text-strong)]">
            {value}
          </p>
        ) : null}
        <p className="text-[11px] leading-snug text-[var(--dash-text-muted)]">{note}</p>
      </div>
    </>
  );

  const className = 'dash-overview-kpi-cell group';

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
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

function OverviewMetricsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="skeleton h-80 rounded-xl xl:col-span-8" />
        <div className="skeleton h-80 rounded-xl xl:col-span-4" />
      </div>
    </>
  );
}

export default function DashboardOverviewContent() {
  const { user: sessionUser, modules: sessionModules } = useDashboardSession();
  const { visibleDomains } = useDashboardModuleOrder();
  const { activeEntity, loading: entityLoading } = useEntity();
  const [coreLoading, setCoreLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [totalStaff, setTotalStaff] = useState(0);
  const [onDuty, setOnDuty] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [openAttendanceExceptions, setOpenAttendanceExceptions] = useState(0);
  const [grossTotal, setGrossTotal] = useState(0);
  const [netTotal, setNetTotal] = useState(0);
  const [deductionsTotal, setDeductionsTotal] = useState(0);
  const [payrollDenied, setPayrollDenied] = useState(false);
  const [myOnboardingTasks, setMyOnboardingTasks] = useState<MyTaskRow[]>([]);
  const [credentialsExpiring, setCredentialsExpiring] = useState(0);
  const [credentialsExpired, setCredentialsExpired] = useState(0);
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [crossModule, setCrossModule] = useState<OverviewCrossModuleMetrics>({
    invoicesOutstanding: 0,
    vendorBillsOutstanding: 0,
    activeFleetTrips: 0,
    openFleetIncidents: 0,
    pendingPurchaseRequests: 0,
  });
  const [hrDetailsOpen, setHrDetailsOpen] = useState(false);

  useEffect(() => {
    if (entityLoading) return;

    let cancelled = false;
    setCoreLoading(true);
    setDetailsLoading(true);

    const loadCore = async () => {
      try {
        const res = await fetch('/api/dashboard/overview?metricsOnly=1&slice=core', { credentials: 'include' });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setTotalStaff(data.totalStaff ?? 0);
        setOnDuty(data.onDuty ?? 0);
        setPendingApprovals(data.pendingApprovals ?? 0);
        setOpenAttendanceExceptions(data.openAttendanceExceptions ?? 0);
        setPayrollDenied(Boolean(data.payroll?.denied));
        setGrossTotal(data.payroll?.grossTotal ?? 0);
        setNetTotal(data.payroll?.netTotal ?? 0);
        setDeductionsTotal(data.payroll?.deductionsTotal ?? 0);
        setCredentialsExpiring(data.credentialsExpiring ?? 0);
        setCredentialsExpired(data.credentialsExpired ?? 0);
        setUnreadNotifications(data.unreadNotifications ?? 0);
        setCrossModule({
          invoicesOutstanding: data.crossModule?.invoicesOutstanding ?? 0,
          vendorBillsOutstanding: data.crossModule?.vendorBillsOutstanding ?? 0,
          activeFleetTrips: data.crossModule?.activeFleetTrips ?? 0,
          openFleetIncidents: data.crossModule?.openFleetIncidents ?? 0,
          pendingPurchaseRequests: data.crossModule?.pendingPurchaseRequests ?? 0,
        });
      } finally {
        if (!cancelled) setCoreLoading(false);
      }
    };

    const loadDetails = async () => {
      try {
        const res = await fetch('/api/dashboard/overview?metricsOnly=1&slice=details', { credentials: 'include' });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setAttendanceRows(Array.isArray(data.attendanceRows) ? data.attendanceRows : []);
        setMyOnboardingTasks(Array.isArray(data.myOnboardingTasks) ? data.myOnboardingTasks : []);
        setPinnedHrefs(Array.isArray(data.pinnedHrefs) ? data.pinnedHrefs : []);
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    void loadCore();
    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [activeEntity.id, entityLoading]);

  const me = sessionUser;
  const modules = sessionModules;
  const persona = useMemo(() => resolveOverviewPersona(me), [me]);

  useEffect(() => {
    setHrDetailsOpen(shouldExpandHrDetails(persona));
  }, [persona]);
  const fx = useMemo(
    () => (amount: number) => formatMoney(amount, activeEntity.currency),
    [activeEntity.currency],
  );
  const [periodLabel, setPeriodLabel] = useState('');
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    setPeriodLabel(new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
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
        myOnboardingCount: myOnboardingTasks.length,
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
      myOnboardingTasks.length,
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
  const secondaryAction = useMemo(() => getOverviewSecondaryAction(me, persona), [me, persona]);

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

  const showPayroll = shouldShowPayrollBlock(persona, payrollDenied);
  const showAttendance = modules.time !== false;
  const showHrSection = modules.core !== false || modules.time !== false || modules.payroll !== false;

  const kpiCards = useMemo(
    () =>
      buildCrossModuleKpis({
        totalStaff,
        onDuty,
        pendingLeave: pendingApprovals,
        credentialsExpiring,
        credentialsExpired,
        crossModule,
        persona,
        modules,
      }),
    [totalStaff, onDuty, pendingApprovals, credentialsExpiring, credentialsExpired, crossModule, persona, modules],
  );

  const { layout, isCustom, toggleWidgetPin, isWidgetPinned } = useDashboardOverviewLayout();

  const orderedKpiCards = useMemo(
    () => orderKpisByLayout(kpiCards, layout),
    [kpiCards, layout],
  );

  const eligibleFullWidthWidgets = useMemo(() => {
    const ids: OverviewWidgetId[] = ['command-center'];
    if (!coreLoading && attentionItems.length > 0) ids.push('attention');
    if (!coreLoading && orderedKpiCards.length > 0) ids.push('snapshot');
    return ids;
  }, [coreLoading, attentionItems.length, orderedKpiCards.length]);

  const orderedFullWidthWidgets = useMemo(
    () => resolveWidgetOrder(eligibleFullWidthWidgets, layout, FULL_WIDTH_OVERVIEW_WIDGETS),
    [eligibleFullWidthWidgets, layout],
  );

  const eligibleSidebarWidgets = useMemo(() => {
    const ids: OverviewWidgetId[] = ['shortcuts'];
    if (!detailsLoading) ids.push('notifications');
    if (!coreLoading && (credentialsExpiring > 0 || credentialsExpired > 0) && modules.core !== false) {
      ids.push('credentials');
    }
    return ids;
  }, [coreLoading, detailsLoading, credentialsExpiring, credentialsExpired, modules.core]);

  const orderedSidebarWidgets = useMemo(
    () => resolveWidgetOrder(eligibleSidebarWidgets, layout, SIDEBAR_OVERVIEW_WIDGETS),
    [eligibleSidebarWidgets, layout],
  );

  const showHrDetailsWidget =
    !detailsLoading &&
    !coreLoading &&
    showHrSection &&
    !(layout.hiddenWidgets ?? []).includes('hr-details');

  if (!me) {
    return (
      <div className="page-shell">
        <div className="skeleton h-36 rounded-2xl" />
        <OverviewMetricsSkeleton />
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

      {coreLoading ? (
        <OverviewMetricsSkeleton />
      ) : (
        <>
      {orderedFullWidthWidgets.includes('attention') && attentionItems.length > 0 ? (
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

      {orderedFullWidthWidgets.includes('snapshot') && orderedKpiCards.length > 0 ? (
        <section className="dashboard-panel group/pin-target overflow-hidden">
          <OverviewWidgetHeader
            widgetId="snapshot"
            title="Business snapshot"
            trailing={<p className="text-[11px] text-[var(--dash-text-subtle)]">One signal per module</p>}
          />
          <div className="dash-overview-hairline-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {orderedKpiCards.map((tile) => (
              <KpiCard key={tile.domainId} {...tile} />
            ))}
          </div>
        </section>
      ) : null}

      {showHrDetailsWidget || orderedSidebarWidgets.length > 0 ? (
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {showHrDetailsWidget ? (
        <div className="space-y-6 xl:col-span-8">
            <div className="dashboard-panel group/pin-target overflow-hidden">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--dash-border-subtle)] px-4 py-3.5 sm:px-5">
                <button
                  type="button"
                  onClick={() => setHrDetailsOpen((open) => !open)}
                  className="min-w-0 flex-1 text-left"
                  aria-expanded={hrDetailsOpen}
                >
                  <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">HR & Payroll details</h2>
                  <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">
                    Attendance, payroll run, and onboarding — expand when you need people depth
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <OverviewPinButton
                    isPinned={isWidgetPinned('hr-details')}
                    label="HR & Payroll details"
                    onToggle={() => void toggleWidgetPin('hr-details')}
                  />
                  <button
                    type="button"
                    onClick={() => setHrDetailsOpen((open) => !open)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
                    aria-label={hrDetailsOpen ? 'Collapse HR details' : 'Expand HR details'}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${hrDetailsOpen ? 'rotate-90' : ''}`}
                    />
                  </button>
                </div>
              </div>
              {hrDetailsOpen ? (
                <div className="space-y-6 border-t border-neutral-100 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
          {showAttendance ? (
            <OverviewPanelFlush
              title="Today's attendance"
              subtitle={`Live clock-ins for ${activeEntity.name}`}
              action={
                <Link
                  href="/dashboard/attendance"
                  className="text-xs font-medium text-primary-700 hover:text-primary-800"
                >
                  View all
                </Link>
              }
            >
              {attendanceRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 text-primary-600 ring-1 ring-primary-200/50">
                    <Clock className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-neutral-700">No clock-ins yet today</p>
                  <p className="mt-1 max-w-sm text-xs text-neutral-500">
                    Staff appear here after clock-in or biometric device sync.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table dashboard-data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th className="col-center">Clock in</th>
                        <th className="col-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRows.map((r) => (
                        <tr key={r.id}>
                          <td className="col-primary font-medium text-ink">
                            {`${r.employee?.firstName ?? ''} ${r.employee?.lastName ?? ''}`.trim() || 'Unknown'}
                          </td>
                          <td className="col-center tabular-nums text-neutral-600">
                            {r.firstInAt
                              ? new Date(r.firstInAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="col-center">
                            <span
                              className={`badge-status ${
                                Number(r.lateMinutes ?? 0) > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {Number(r.lateMinutes ?? 0) > 0 ? 'Late' : 'On time'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </OverviewPanelFlush>
          ) : null}

          {showPayroll && modules.payroll !== false ? (
            <OverviewPanel
              title="Payroll summary"
              subtitle={`${periodLabel} · ${activeEntity.currency}`}
              action={
                !payrollDenied ? (
                  <Link href="/dashboard/payroll" className="text-xs font-medium text-primary-700 hover:text-primary-800">
                    Open payroll →
                  </Link>
                ) : undefined
              }
            >
              {payrollDenied ? (
                <p className="text-sm text-neutral-600">
                  Payroll totals are restricted for your account. Contact finance or an administrator for access to{' '}
                  {activeEntity.name} payroll data.
                </p>
              ) : (
                <div className="dash-overview-stat-row">
                  {[
                    { label: 'Gross pay', value: fx(grossTotal) },
                    { label: 'Net pay', value: fx(netTotal) },
                    { label: 'Statutory & taxes', value: fx(deductionsTotal) },
                  ].map((row) => (
                    <div key={row.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-muted)]">{row.label}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--dash-text-strong)]">{row.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </OverviewPanel>
          ) : null}

          {modules.core !== false ? (
            <OverviewPanel
              title="My onboarding tasks"
              action={
                <Link href="/dashboard/onboarding" className="text-xs font-medium text-primary-700 hover:text-primary-800">
                  Workspace →
                </Link>
              }
            >
              <p className="-mt-2 mb-3 text-xs tabular-nums text-neutral-400">{myOnboardingTasks.length} pending</p>
              <div className="space-y-2">
                {myOnboardingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 rounded-lg px-1 py-2 transition hover:bg-[var(--dash-hover)]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {task.title}
                        <span className="font-normal text-neutral-500">
                          {' '}
                          · {task.workflow.employee.firstName} {task.workflow.employee.lastName}
                        </span>
                      </p>
                      <p className={`mt-0.5 text-xs tabular-nums ${task.status === 'OVERDUE' ? 'text-red-600' : 'text-neutral-500'}`}>
                        {task.status}
                        {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    {task.status === 'OVERDUE' ? (
                      <span className="flex-shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                ))}
                {myOnboardingTasks.length === 0 ? (
                  <p className="py-4 text-center text-sm text-neutral-500">You&apos;re all caught up — no pending onboarding tasks.</p>
                ) : null}
              </div>
            </OverviewPanel>
          ) : null}
                </div>
              ) : null}
            </div>
        </div>
        ) : null}

        {orderedSidebarWidgets.length > 0 ? (
        <aside className={`space-y-6 ${showHrDetailsWidget ? 'xl:col-span-4' : 'xl:col-span-12'}`}>
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
              title="Recent updates"
              trailing={
                unreadNotifications > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                    <Bell className="h-3 w-3" />
                    {unreadNotifications}
                  </span>
                ) : null
              }
            />
            {detailsLoading ? (
              <div className="skeleton mx-4 mb-4 h-24 rounded-lg sm:mx-5" aria-hidden />
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)] sm:px-5">No recent notifications.</p>
            ) : (
              <ul className="divide-y divide-[var(--dash-border-subtle)]">
                {notifications.map((n) => (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        className={`dash-overview-row-link block rounded-none px-4 py-3 sm:px-5 ${n.unread ? 'bg-[var(--dash-surface-muted)]/60' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--dash-text-strong)]">{n.title}</p>
                          {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-[var(--dash-text-muted)]">{n.body}</p> : null}
                          <p className="mt-1 text-[11px] tabular-nums text-[var(--dash-text-subtle)]">{formatRelativeTime(n.createdAt)}</p>
                        </div>
                      </Link>
                    ) : (
                      <div className={`px-4 py-3 sm:px-5 ${n.unread ? 'bg-[var(--dash-surface-muted)]/60' : ''}`}>
                        <p className="text-sm font-medium text-[var(--dash-text-strong)]">{n.title}</p>
                        {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-[var(--dash-text-muted)]">{n.body}</p> : null}
                        <p className="mt-1 text-[11px] tabular-nums text-[var(--dash-text-subtle)]">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          ) : null}

          {orderedSidebarWidgets.includes('credentials') &&
          (credentialsExpiring > 0 || credentialsExpired > 0) &&
          modules.core !== false ? (
            <div className="group/pin-target rounded-xl border border-amber-300/40 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
              <div className="mb-2 flex items-center justify-end">
                <OverviewPinButton
                  isPinned={isWidgetPinned('credentials')}
                  label="Credential compliance"
                  onToggle={() => void toggleWidgetPin('credentials')}
                />
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                  <BadgeCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-950">Credential compliance</p>
                  <p className="mt-1 text-xs text-amber-900/80">
                    {credentialsExpiring > 0 ? `${credentialsExpiring} expiring soon` : null}
                    {credentialsExpiring > 0 && credentialsExpired > 0 ? ' · ' : null}
                    {credentialsExpired > 0 ? `${credentialsExpired} expired` : null}
                  </p>
                  <Link href="/dashboard/credentials?status=expiring_soon" className="mt-2 inline-flex text-xs font-medium text-amber-950 underline-offset-2 hover:underline">
                    Review credentials →
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
        ) : null}
      </section>
      ) : null}
        </>
      )}
    </div>
  );
}
