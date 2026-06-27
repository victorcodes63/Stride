'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Bell,
  X,
  ChevronDown,
  HelpCircle,
  Menu,
  LogOut,
} from 'lucide-react';
import CommandPalette from './CommandPalette';
import { DashboardBreadcrumbs } from './DashboardBreadcrumbs';
import { DashboardModuleSwitcher } from './DashboardModuleSwitcher';
import { DashboardThemeToggle } from '@/components/dashboard/DashboardThemeToggle';
import { EntitySwitcher, useEntity } from '@/components/EntitySwitcher';
import {
  WorkspaceControlProvider,
} from '@/components/dashboard/WorkspaceControlContext';
import type { UserSummary } from '@/types/dashboard';
import type { ModuleKey } from '@/lib/modules';
import { resolveDashboardBreadcrumbs } from '@/lib/dashboard-breadcrumbs';
import { ALL_MODULES_ENABLED } from '@/lib/dashboard-nav-catalog';
import { DASHBOARD_SHELL_GUTTER } from '@/lib/dashboard-layout';
import { useDashboardDomain } from '@/contexts/dashboard-domain';
import { getDomainQuickActions } from '@/lib/dashboard-domain-quick-actions';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  unread: boolean;
  createdAt: string;
};

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const iconBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg dash-icon-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30';

const NOTIFICATIONS_PANEL_WIDTH = 320;

/** Fixed panel aligned to the right edge of an anchor element (portaled to avoid overflow clipping). */
function TopbarAnchoredPopover({
  open,
  anchorRef,
  panelRef,
  width,
  children,
  className = '',
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef?: RefObject<HTMLDivElement | null>;
  width: number;
  children: ReactNode;
  className?: string;
}) {
  const [style, setStyle] = useState<CSSProperties>({});

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, rect.right - width);
    setStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      width,
      zIndex: 50,
    });
  }, [anchorRef, width]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={panelRef} style={style} className={className}>
      {children}
    </div>,
    document.body,
  );
}

interface DashboardTopbarProps {
  currentUser: UserSummary | null;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  enabledModules?: Record<ModuleKey, boolean>;
  contentGutterClass?: string;
}

export default function DashboardTopbar({
  currentUser,
  sidebarOpen = true,
  onToggleSidebar = () => {},
  enabledModules = ALL_MODULES_ENABLED,
  contentGutterClass = DASHBOARD_SHELL_GUTTER,
}: DashboardTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { activeDomain } = useDashboardDomain();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const utilityIconsRef = useRef<HTMLDivElement>(null);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const { showSwitcher, entities, loading: entitiesLoading } = useEntity();
  const hasEntitySwitcher = !entitiesLoading && showSwitcher && entities.length > 1;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const breadcrumbs = useMemo(() => {
    if (sidebarOpen) return [];
    return resolveDashboardBreadcrumbs(pathname, {
      currentUserRole: currentUser?.role ?? null,
      hasAccountsAccess: currentUser?.hasAccountsAccess ?? false,
      canViewSystemAnalytics: currentUser?.canViewSystemAnalytics ?? false,
      enabledModules,
    });
  }, [sidebarOpen, pathname, currentUser, enabledModules]);

  const loadNotifications = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard/notifications?limit=30');
      if (!r.ok) return;
      const data = (await r.json()) as { notifications?: NotificationItem[]; unreadCount?: number };
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
      if (typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 2000);
    const interval = setInterval(() => {
      void loadNotifications();
    }, 30_000);
    return () => {
      window.clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        if (!notificationsPanelRef.current?.contains(target)) {
          setNotificationsOpen(false);
        }
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(target)) {
        setQuickActionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const domainActions = useMemo(
    () => getDomainQuickActions(activeDomain.id, currentUser, enabledModules),
    [activeDomain.id, currentUser, enabledModules],
  );
  const PrimaryIcon = domainActions.primary.icon;

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/dashboard/login';
  }, []);

  return (
    <header className="print:hidden sticky top-0 z-30 flex-shrink-0 overflow-visible border-b dash-topbar">
      <div className={`flex h-14 items-center gap-2 sm:gap-3 ${contentGutterClass}`}>
        {/* Left: menu + breadcrumbs — only when sidebar is collapsed */}
        {!sidebarOpen ? (
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleSidebar}
              className={iconBtnClass}
              aria-expanded={sidebarOpen}
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            {breadcrumbs.length > 0 ? (
              <DashboardBreadcrumbs
                crumbs={breadcrumbs}
                className="hidden min-w-0 max-w-[9rem] md:max-w-xs lg:max-w-sm xl:max-w-md md:flex"
              />
            ) : null}
          </div>
        ) : null}

        {/* Search — fills available space between breadcrumbs and actions */}
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-text-subtle)]"
            strokeWidth={1.75}
          />
          <input
            type="search"
            placeholder={sidebarOpen ? 'Search employees, payroll, departments…' : 'Search…'}
            onFocus={() => setPaletteOpen(true)}
            readOnly
            className="h-9 w-full cursor-pointer rounded-lg border pl-9 pr-14 text-sm transition-colors dash-search-input focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            aria-label="Search"
          />
          <kbd className="dash-kbd pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">
            ⌘K
          </kbd>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} initialQuery="" />

        {/* Workspace: module + entity when multi-entity; otherwise standalone module switcher */}
        {hasEntitySwitcher ? (
          <WorkspaceControlProvider rootRef={workspaceRef}>
            <div
              ref={workspaceRef}
              className="hidden h-9 shrink-0 items-stretch overflow-visible rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)] sm:flex"
            >
              <DashboardModuleSwitcher embedded />
              <div className="w-px shrink-0 self-stretch bg-[var(--dash-border-subtle)]" aria-hidden />
              <EntitySwitcher variant="topbar" embedded />
            </div>
          </WorkspaceControlProvider>
        ) : (
          <div className="hidden shrink-0 sm:block">
            <DashboardModuleSwitcher />
          </div>
        )}
        <div className="sm:hidden">
          <DashboardModuleSwitcher />
        </div>

        {/* Right actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div className="relative flex items-stretch" ref={quickActionsRef}>
            <Link
              href={domainActions.primary.href}
              className="flex h-9 items-center gap-1.5 rounded-l-lg border border-primary-600 bg-primary-600 px-2.5 text-sm font-semibold text-white transition-colors hover:border-primary-700 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 sm:gap-2 sm:px-3"
              title={domainActions.primary.description ?? domainActions.primary.label}
            >
              <PrimaryIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="hidden max-w-[9rem] truncate md:inline">{domainActions.primary.label}</span>
              <span className="md:hidden">New</span>
            </Link>
            <button
              type="button"
              onClick={() => setQuickActionsOpen((prev) => !prev)}
              className="flex h-9 items-center rounded-r-lg border border-l-0 border-primary-600 bg-primary-600 px-1.5 text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
              aria-label={`More ${activeDomain.shortLabel} actions`}
              aria-expanded={quickActionsOpen}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {quickActionsOpen ? (
              <div className="dash-popover absolute right-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-xl border py-1">
                <div className="dash-popover-header border-b px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {activeDomain.shortLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">Common actions in this module</p>
                </div>
                <Link
                  href={domainActions.primary.href}
                  onClick={() => setQuickActionsOpen(false)}
                  className="flex items-center gap-3 border-b border-[var(--dash-border-subtle)] bg-[color-mix(in_srgb,var(--brand-primary)_6%,var(--dash-surface-solid))] px-3 py-2.5 text-sm font-medium text-[var(--swatch-coral-fg)] transition-colors hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,var(--dash-surface-solid))]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-100">
                    <PrimaryIcon className="h-3.5 w-3.5 text-primary-700" />
                  </span>
                  <span>
                    {domainActions.primary.label}
                    {domainActions.primary.description ? (
                      <span className="mt-0.5 block text-[11px] font-normal text-neutral-500">
                        {domainActions.primary.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
                {domainActions.more.length > 0 ? (
                  <>
                    <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      More actions
                    </p>
                    {domainActions.more.map(({ label, href, icon: Icon }) => (
                      <Link
                        key={href + label}
                        href={href}
                        onClick={() => setQuickActionsOpen(false)}
                        className="dash-popover-item flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--dash-text)] transition-colors hover:text-[var(--brand-primary)]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100">
                          <Icon className="h-3.5 w-3.5 text-neutral-600" />
                        </span>
                        {label}
                      </Link>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            ref={utilityIconsRef}
            className="flex h-9 items-center gap-0.5 rounded-lg border border-[var(--dash-border-subtle)] px-0.5"
          >
            <div className="hidden md:contents">
              <DashboardThemeToggle />
              <Link
                href="/dashboard/help"
                className={`${iconBtnClass} h-8 w-8`}
                aria-label="Help and support"
                title="Help & support"
              >
                <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </Link>
            </div>
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => {
                    const next = !prev;
                    if (next) loadNotifications();
                    return next;
                  });
                }}
                className={`${iconBtnClass} h-8 w-8`}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
                {unreadCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-0.5 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={`${iconBtnClass} h-8 w-8`}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>

          <TopbarAnchoredPopover
            open={notificationsOpen}
            anchorRef={utilityIconsRef}
            panelRef={notificationsPanelRef}
            width={NOTIFICATIONS_PANEL_WIDTH}
            className="dash-popover overflow-hidden rounded-xl border"
          >
            <div className="dash-popover-header flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Notifications</h3>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">
                  No notifications yet. Contract reminders and other alerts will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {notifications.map((n) => {
                    const markReadAndGo = async () => {
                      if (n.unread) {
                        await fetch('/api/dashboard/notifications', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ids: [n.id] }),
                        });
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)),
                        );
                        setUnreadCount((c) => Math.max(0, c - 1));
                      }
                      setNotificationsOpen(false);
                      if (n.href) router.push(n.href);
                    };
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void markReadAndGo()}
                          className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--dash-hover)] ${n.unread ? 'bg-[color-mix(in_srgb,var(--brand-primary)_8%,var(--dash-surface-solid))]' : ''}`}
                        >
                          <span className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{n.title}</p>
                            <p className="line-clamp-2 text-xs text-neutral-600">{n.body}</p>
                            <p className="mt-0.5 text-xs text-neutral-400">{formatNotifTime(n.createdAt)}</p>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {notifications.length > 0 ? (
              <div className="dash-popover-header border-t px-4 py-2">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/dashboard/notifications', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ markAllRead: true }),
                    });
                    setNotifications((prev) => prev.map((x) => ({ ...x, unread: false })));
                    setUnreadCount(0);
                  }}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Mark all read
                </button>
              </div>
            ) : null}
          </TopbarAnchoredPopover>

          <div className="sm:hidden">
            <EntitySwitcher variant="topbar" />
          </div>
        </div>
      </div>

      {!sidebarOpen && breadcrumbs.length > 0 ? (
        <div className={`border-t border-[var(--dash-border-subtle)] py-2 md:hidden ${contentGutterClass}`}>
          <DashboardBreadcrumbs crumbs={breadcrumbs} />
        </div>
      ) : null}
    </header>
  );
}
