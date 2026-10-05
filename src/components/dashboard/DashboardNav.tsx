'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { UserRole } from '@/types/dashboard';
import type { EnabledModulesMap } from '@/lib/nav-modules';
import {
  ALL_MODULES_ENABLED,
  buildDashboardNavSections,
  OVERVIEW_NAV_ITEM,
  OVERVIEW_PERSONAL_LINKS,
  PERSONAL_PLANNING_LINKS,
  resolveDashboardNavItems,
  type DashboardNavItem,
  type DashboardNavSection,
} from '@/lib/dashboard-nav-catalog';
import {
  filterNavSectionsForDomain,
  getDomainOverviewNavItem,
  isDashboardCommandCenterPath,
  isHrefInDomain,
} from '@/lib/dashboard-module-domains';
import { useDashboardDomain } from '@/contexts/dashboard-domain';
import { useDashboardModuleOrder } from '@/contexts/dashboard-module-order';
import { useEntity } from '@/components/EntitySwitcher';
import { getNavItemReadiness } from '@/lib/dashboard-nav-readiness';
import { NavReadinessBadge } from '@/components/dashboard/NavReadinessBadge';
import {
  readOverviewAttentionCount,
  subscribeOverviewCoreCache,
} from '@/lib/dashboard-overview-cache';
import { ChevronRight, Pin, PinOff, type LucideIcon } from 'lucide-react';

const NAV_STORAGE_KEY = 'dashboard-nav-expanded';
const SIDEBAR_COLLAPSED_KEY = 'dashboard-sidebar-collapsed';
const PLAN_MY_WORK_COLLAPSED_KEY = 'dashboard-nav-plan-work-collapsed';

interface DashboardNavProps {
  currentUserRole: UserRole | null;
  hasAccountsAccess?: boolean;
  canViewSystemAnalytics?: boolean;
  canAccessCompanySetup?: boolean;
  enabledModules?: EnabledModulesMap;
  /** Used to read the shared overview metrics cache for the Action Center badge. */
  currentOrgId?: string | null;
  onNavigate?: () => void;
}

function isPathActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  const base = href.split('?')[0];
  return pathname === base || pathname.startsWith(base + '/');
}

function NavPinButton({
  href,
  isPinned,
  onTogglePin,
  variant = 'default',
}: {
  href: string;
  isPinned: boolean;
  onTogglePin: (href: string) => void;
  variant?: 'default' | 'onPrimary';
}) {
  const idleClass =
    variant === 'onPrimary'
      ? 'text-white/50 opacity-60 group-hover/link-row:opacity-100 group-hover/link-row:text-white hover:bg-white/15 hover:text-white'
      : 'text-[var(--dash-text-muted)] opacity-50 group-hover/link-row:opacity-100 hover:bg-[var(--dash-hover)] hover:text-[var(--stride-coral)]';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onTogglePin(href);
      }}
      className={`ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:opacity-100 ${
        isPinned
          ? variant === 'onPrimary'
            ? 'text-white opacity-100 hover:bg-white/15'
            : 'text-[var(--stride-coral)] opacity-100'
          : idleClass
      }`}
      title={isPinned ? 'Unpin from top' : 'Pin to top'}
      aria-label={isPinned ? `Unpin ${href} from top` : `Pin ${href} to top`}
      aria-pressed={isPinned}
    >
      {isPinned ? <PinOff className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />}
    </button>
  );
}

function NavSubLink({
  href,
  label,
  pathname,
  onNavigate,
  isPinned,
  onTogglePin,
  isLast = false,
  sectionActive = false,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate?: () => void;
  isPinned: boolean;
  onTogglePin: (href: string) => void;
  isLast?: boolean;
  sectionActive?: boolean;
}) {
  const isActive = isPathActive(pathname, href);
  const connectorClass = sectionActive
    ? 'bg-[rgba(var(--stride-coral-rgb),0.35)]'
    : 'bg-[var(--dash-border-subtle)]';
  const readiness = getNavItemReadiness(href);

  return (
    <div className="relative flex items-stretch">
      <div className="relative ml-3 w-4 flex-shrink-0">
        <span
          className={`absolute left-0 top-0 w-px ${connectorClass} ${isLast ? 'h-3.5' : 'bottom-0 h-full'}`}
          aria-hidden
        />
        <span className={`absolute left-0 top-3.5 h-px w-3 ${connectorClass}`} aria-hidden />
      </div>
      <Link
        href={href}
        onClick={onNavigate}
        title={label}
        className={`group/link-row dash-nav-sub focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
          isActive ? 'is-active' : ''
        }`}
      >
        <span className="truncate">{label}</span>
        <NavReadinessBadge readiness={readiness} compact />
        <NavPinButton href={href} isPinned={isPinned} onTogglePin={onTogglePin} />
      </Link>
    </div>
  );
}

function NavRootLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
  isPinned,
  onTogglePin,
  badgeCount,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  onNavigate?: () => void;
  isPinned: boolean;
  onTogglePin: (href: string) => void;
  badgeCount?: number;
}) {
  const isActive = isPathActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group/link-row dash-nav-root focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
        isActive ? 'is-active' : ''
      }`}
    >
      <Icon className="dash-nav-icon" />
      <span className="truncate">{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span
          className={`ml-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none tabular-nums ${
            isActive
              ? 'bg-white/20 text-white'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
          }`}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      ) : null}
      <NavPinButton
        href={href}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
        variant={isActive ? 'onPrimary' : 'default'}
      />
    </Link>
  );
}

function isSameNavHref(a: string, b: string): boolean {
  return a.split('?')[0] === b.split('?')[0];
}

function NavGroupLabel({ label }: { label: string }) {
  return <p className="dash-nav-group-label">{label}</p>;
}

function getStoredExpanded(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(NAV_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function setStoredExpanded(expanded: Set<string>) {
  try {
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify([...expanded]));
  } catch {
    /* ignore */
  }
}

function getActiveSectionIds(sections: DashboardNavSection[], pathname: string): Set<string> {
  const active = new Set<string>();
  for (const section of sections) {
    if (section.items.some((item) => isPathActive(pathname, item.href))) {
      active.add(section.id);
    }
  }
  return active;
}

function isPlanMyWorkPath(pathname: string): boolean {
  const links = [...PERSONAL_PLANNING_LINKS, ...OVERVIEW_PERSONAL_LINKS];
  return links.some((item) => isPathActive(pathname, item.href));
}

export function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export default function DashboardNav({
  currentUserRole,
  hasAccountsAccess = false,
  canViewSystemAnalytics = false,
  canAccessCompanySetup = false,
  enabledModules = ALL_MODULES_ENABLED,
  currentOrgId = null,
  onNavigate,
}: DashboardNavProps) {
  const { activeDomainId, activeDomain, pathname } = useDashboardDomain();
  const { visibleDomains } = useDashboardModuleOrder();
  const { activeEntity } = useEntity();
  const overviewItem = useMemo(() => getDomainOverviewNavItem(activeDomainId), [activeDomainId]);

  const navOptions = useMemo(
    () => ({
      currentUserRole,
      hasAccountsAccess,
      canViewSystemAnalytics,
      canAccessCompanySetup,
      enabledModules,
    }),
    [canAccessCompanySetup, canViewSystemAnalytics, currentUserRole, enabledModules, hasAccountsAccess],
  );

  const sections = useMemo(() => {
    const all = buildDashboardNavSections(navOptions);
    return filterNavSectionsForDomain(all, activeDomainId);
  }, [navOptions, activeDomainId]);

  const flattenNav = sections.length === 1;
  const isCommandCenter = isDashboardCommandCenterPath(pathname);
  const overviewHref = overviewItem.href.split('?')[0];
  const isOverviewSubItem = useCallback(
    (href: string) => isSameNavHref(href, overviewHref),
    [overviewHref],
  );
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [attentionBadgeCount, setAttentionBadgeCount] = useState(0);

  const pinnedItems = useMemo(() => {
    const inDomain = pinnedHrefs.filter((href) => isHrefInDomain(href, activeDomainId));
    return resolveDashboardNavItems(inDomain, sections, false);
  }, [pinnedHrefs, sections, activeDomainId]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [planWorkExpanded, setPlanWorkExpanded] = useState(true);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    let cancelled = false;
    fetch('/api/dashboard/nav-preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { pinned?: string[] } | null) => {
        if (cancelled || !data?.pinned) return;
        setPinnedHrefs(Array.isArray(data.pinned) ? data.pinned : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPinsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted || !currentOrgId) return;
    let cancelled = false;

    const applyCount = (count: number | null) => {
      if (cancelled || count == null) return;
      setAttentionBadgeCount(count > 0 ? count : 0);
    };

    const cached = readOverviewAttentionCount(currentOrgId, activeEntity.id);
    if (cached != null) {
      applyCount(cached);
    } else {
      // Cold nav (never hit Overview) — cheap leave/attendance counts only.
      fetch('/api/dashboard/attention?summaryOnly=1', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { summary?: { total?: number } } | null) => {
          if (cancelled) return;
          const total = data?.summary?.total;
          applyCount(typeof total === 'number' ? total : 0);
        })
        .catch(() => {
          if (!cancelled) setAttentionBadgeCount(0);
        });
    }

    const unsubscribe = subscribeOverviewCoreCache((detail) => {
      if (detail.orgId !== currentOrgId || detail.entityId !== activeEntity.id) return;
      applyCount(detail.attentionCount);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hasMounted, currentOrgId, activeEntity.id]);

  useEffect(() => {
    if (!hasMounted) return;
    setExpanded(new Set(sections.map((section) => section.id)));
  }, [activeDomainId, hasMounted, sections]);

  useEffect(() => {
    if (!hasMounted) return;
    const stored = getStoredExpanded();
    const activeSections = getActiveSectionIds(sections, pathname);
    const expandedSet = new Set([...stored, ...activeSections]);
    setExpanded(expandedSet);
    setHydrated(true);
    try {
      const collapsed = localStorage.getItem(PLAN_MY_WORK_COLLAPSED_KEY) === '1';
      setPlanWorkExpanded(isPlanMyWorkPath(pathname) ? true : !collapsed);
    } catch {
      setPlanWorkExpanded(true);
    }
  }, [hasMounted, pathname, sections]);

  const togglePlanWork = useCallback(() => {
    setPlanWorkExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PLAN_MY_WORK_COLLAPSED_KEY, next ? '0' : '1');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const persistPins = useCallback(async (next: string[]) => {
    try {
      const response = await fetch('/api/dashboard/nav-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: next }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { pinned?: string[] };
      if (Array.isArray(data.pinned)) setPinnedHrefs(data.pinned);
    } catch {
      /* keep optimistic state */
    }
  }, []);

  const togglePin = useCallback(
    (href: string) => {
      setPinnedHrefs((prev) => {
        const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
        void persistPins(next);
        return next;
      });
    },
    [persistPins],
  );

  const isPinned = useCallback((href: string) => pinnedHrefs.includes(href), [pinnedHrefs]);

  const toggleSection = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setStoredExpanded(next);
      return next;
    });
  };

  const attentionBadgeFor = (href: string) =>
    href === '/dashboard/attention' && attentionBadgeCount > 0 ? attentionBadgeCount : undefined;

  const renderPinnedLink = (item: DashboardNavItem) => (
    <NavRootLink
      key={item.href}
      {...item}
      pathname={pathname}
      onNavigate={onNavigate}
      isPinned={isPinned(item.href)}
      onTogglePin={togglePin}
      badgeCount={attentionBadgeFor(item.href)}
    />
  );

  const showDomainOverview = !isCommandCenter;

  return (
    <nav
      className="flex-1 flex flex-col overflow-x-hidden px-2.5 py-1.5"
      aria-label={isCommandCenter ? 'Business overview navigation' : `${activeDomain.shortLabel} navigation`}
    >
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {pinsLoaded && pinnedItems.length > 0 && !isCommandCenter ? (
          <div className="mb-1">
            <NavGroupLabel label="Pinned" />
            <div className="space-y-0.5">{pinnedItems.map(renderPinnedLink)}</div>
          </div>
        ) : null}

        {showDomainOverview && !isCommandCenter ? (
          <NavRootLink
            {...overviewItem}
            pathname={pathname}
            onNavigate={onNavigate}
            isPinned={isPinned(overviewItem.href)}
            onTogglePin={togglePin}
          />
        ) : null}

        {isCommandCenter ? (
          <div className="mt-1">
            <NavRootLink
              {...OVERVIEW_NAV_ITEM}
              pathname={pathname}
              onNavigate={onNavigate}
              isPinned={isPinned(OVERVIEW_NAV_ITEM.href)}
              onTogglePin={togglePin}
            />
            <NavGroupLabel label="Modules" />
            <div className="space-y-0.5">
              {visibleDomains.map((domain) => {
                const DomainIcon = domain.icon;
                const isActive = isPathActive(pathname, domain.hubHref);
                return (
                  <Link
                    key={domain.id}
                    href={domain.hubHref}
                    onClick={onNavigate}
                    className={`group/link-row dash-nav-root focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
                      isActive ? 'is-active' : ''
                    }`}
                  >
                    <DomainIcon className="dash-nav-icon" />
                    <span className="truncate">{domain.shortLabel}</span>
                  </Link>
                );
              })}
            </div>
            <p className="dash-nav-hint">
              Pick a module to focus the sidebar, or stay here for the cross-module command center.
            </p>
          </div>
        ) : flattenNav && sections[0] ? (
          <div className="mt-1 space-y-0.5">
            {sections[0].items
              .filter((item) => !isOverviewSubItem(item.href))
              .map((item, index, items) => (
                <NavSubLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  isPinned={isPinned(item.href)}
                  onTogglePin={togglePin}
                  isLast={index === items.length - 1}
                  sectionActive={items.some((i) => isPathActive(pathname, i.href))}
                />
              ))}
          </div>
        ) : (
          sections.map((section) => {
            const isExpanded = hasMounted && hydrated ? expanded.has(section.id) : false;
            const sectionActive = section.items.some((item) => isPathActive(pathname, item.href));
            const SectionIcon = section.icon;

            return (
              <div key={section.id}>
                <div>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className={`dash-nav-section-btn focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
                      sectionActive ? 'is-active' : ''
                    }`}
                    aria-expanded={isExpanded}
                    aria-controls={`nav-section-${section.id}`}
                    id={`nav-trigger-${section.id}`}
                  >
                    <SectionIcon className="dash-nav-icon" />
                    <span className="min-w-0 flex-1 truncate">{section.label}</span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--dash-text-faint)] transition-transform duration-200 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  <div
                    id={`nav-section-${section.id}`}
                    role="region"
                    aria-labelledby={`nav-trigger-${section.id}`}
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                      isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-0.5 pb-1 pt-0.5">
                        {section.items
                          .filter((item) => !isOverviewSubItem(item.href))
                          .map((item, index, items) => (
                            <NavSubLink
                              key={item.href}
                              href={item.href}
                              label={item.label}
                              pathname={pathname}
                              onNavigate={onNavigate}
                              isPinned={isPinned(item.href)}
                              onTogglePin={togglePin}
                              isLast={index === items.length - 1}
                              sectionActive={sectionActive}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 border-t border-[var(--dash-border-subtle)] pt-1 pb-1">
        {(() => {
          const planLinks = isCommandCenter ? OVERVIEW_PERSONAL_LINKS : PERSONAL_PLANNING_LINKS;
          const planActive = planLinks.some((item) => isPathActive(pathname, item.href));
          const planExpanded = !hasMounted || !hydrated ? true : planWorkExpanded;
          return (
            <>
              <button
                type="button"
                onClick={togglePlanWork}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--dash-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
                  planActive ? 'bg-[var(--dash-hover)]' : ''
                }`}
                aria-expanded={planExpanded}
                aria-controls="nav-section-plan-my-work"
                id="nav-trigger-plan-my-work"
              >
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-text-subtle)]">
                  Plan my work
                </span>
                {attentionBadgeCount > 0 && !planExpanded ? (
                  <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-semibold leading-none tabular-nums text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                    {attentionBadgeCount > 99 ? '99+' : attentionBadgeCount}
                  </span>
                ) : null}
                <ChevronRight
                  className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--dash-text-faint)] transition-transform duration-200 ${
                    planExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>
              <div
                id="nav-section-plan-my-work"
                role="region"
                aria-labelledby="nav-trigger-plan-my-work"
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  planExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5 pb-1 pt-0.5">
                    {planLinks.map((item) => (
                      <NavRootLink
                        key={item.href}
                        {...item}
                        pathname={pathname}
                        onNavigate={onNavigate}
                        isPinned={isPinned(item.href)}
                        onTogglePin={togglePin}
                        badgeCount={attentionBadgeFor(item.href)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </nav>
  );
}
