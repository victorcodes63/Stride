'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Bell,
  X,
  ChevronDown,
  LogOut,
  User,
  HelpCircle,
  Menu,
  Palette,
} from 'lucide-react';
import CommandPalette from './CommandPalette';
import { DashboardBreadcrumbs } from './DashboardBreadcrumbs';
import { DashboardModuleSwitcher } from './DashboardModuleSwitcher';
import { DashboardThemeToggle } from '@/components/dashboard/DashboardThemeToggle';
import { EntitySwitcher } from '@/components/EntitySwitcher';
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

interface DashboardTopbarProps {
  currentUser: UserSummary | null;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  enabledModules?: Record<ModuleKey, boolean>;
  contentGutterClass?: string;
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return 'SU';
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'SU';
}

function TopbarDivider() {
  return <div className="hidden h-6 w-px shrink-0 bg-neutral-200 sm:block" aria-hidden />;
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
        setNotificationsOpen(false);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(target)) {
        setQuickActionsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/dashboard/login');
  };

  const displayName = currentUser?.name || 'Staff User';
  const displayEmail = currentUser?.email || 'staff@example.com';
  const initials = getInitials(displayName);

  const domainActions = useMemo(
    () => getDomainQuickActions(activeDomain.id, currentUser, enabledModules),
    [activeDomain.id, currentUser, enabledModules],
  );
  const PrimaryIcon = domainActions.primary.icon;

  return (
    <header className="print:hidden sticky top-0 z-30 flex-shrink-0 border-b dash-topbar">
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
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
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
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-neutral-400 sm:inline-flex">
            ⌘K
          </kbd>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} initialQuery="" />

        <DashboardModuleSwitcher />

        {/* Right actions */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <EntitySwitcher variant="topbar" />

          <TopbarDivider />

          <DashboardThemeToggle />

          <TopbarDivider />

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
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Common actions in this module
                  </p>
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

          <Link
            href="/contact"
            target="_blank"
            rel="noopener noreferrer"
            className={`${iconBtnClass} hidden sm:flex`}
            aria-label="Help / Contact"
            title="Help & contact"
          >
            <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => {
                  const next = !prev;
                  if (next) loadNotifications();
                  return next;
                });
              }}
              className={iconBtnClass}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-0.5 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <div className="dash-popover absolute right-0 top-full z-20 mt-1.5 w-80 overflow-hidden rounded-xl border">
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
              </div>
            ) : null}
          </div>

          <TopbarDivider />

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex h-9 max-w-[12rem] items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 text-neutral-700 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 lg:pr-2"
              aria-label="User menu"
              aria-expanded={userMenuOpen}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 ring-2 ring-white">
                <span className="text-[11px] font-semibold text-primary-800">{initials}</span>
              </div>
              <div className="hidden min-w-0 text-left lg:block">
                <p className="truncate text-sm font-medium leading-tight text-ink">{displayName}</p>
                <p className="truncate text-[11px] leading-tight text-neutral-500">{displayEmail}</p>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-neutral-400 lg:block" />
            </button>
            {userMenuOpen ? (
              <div className="dash-popover absolute right-0 top-full z-20 mt-1.5 w-60 overflow-hidden rounded-xl border py-1">
                <div className="dash-popover-header border-b px-4 py-3">
                  <p className="text-sm font-medium text-[var(--dash-text-strong)]">{displayName}</p>
                  <p className="truncate text-xs text-neutral-500">{displayEmail}</p>
                </div>
                <Link
                  href="/dashboard/settings#appearance"
                  onClick={() => setUserMenuOpen(false)}
                  className="dash-popover-item flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--dash-text)] transition-colors hover:text-[var(--brand-primary)]"
                >
                  <Palette className="h-4 w-4 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
                  Appearance
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setUserMenuOpen(false)}
                  className="dash-popover-item flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--dash-text)] transition-colors hover:text-[var(--brand-primary)]"
                >
                  <User className="h-4 w-4 text-[var(--dash-text-muted)]" />
                  Dashboard home
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <LogOut className="h-4 w-4 text-neutral-500" />
                  Sign out
                </button>
              </div>
            ) : null}
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
