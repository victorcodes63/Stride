'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Bell, LogOut, User, X } from 'lucide-react';
import { EssAppProvider, useEssApp } from '@/contexts/EssAppContext';
import { EssTabBar } from '@/components/ess/EssTabBar';
import { EssOfflineBanner } from '@/components/ess/EssOfflineBanner';
import { EssServiceWorkerRegister } from '@/components/ess/EssServiceWorkerRegister';
import { EssEmptyState, EssListItem } from '@/components/ess/EssUi';
import BrandLogo from '@/components/BrandLogo';
import { DashboardThemeToggle } from '@/components/dashboard/DashboardThemeToggle';

type EssShellBrand = {
  orgName: string;
};

function EssShellInner({ children, brand, themeStyle }: { children: ReactNode; brand: EssShellBrand; themeStyle?: CSSProperties }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    me,
    meLoading,
    notifications,
    unreadCount,
    refreshNotifications,
    markNotificationsRead,
    markAllNotificationsRead,
  } = useEssApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      router.replace('/ess/login');
      return;
    }
    if (me.mustResetPassword && pathname !== '/ess/account-security') {
      router.replace('/ess/account-security');
    }
  }, [me, meLoading, pathname, router]);

  async function onLogout() {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/ess/');
      if (reg) await reg.unregister();
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('ess-')).map((key) => caches.delete(key)));
    }
    await fetch('/api/ess/auth/logout', { method: 'POST' });
    router.replace('/ess/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen ess-app" style={themeStyle}>
      <EssOfflineBanner />
      <header className="sticky top-0 z-20 px-3 pt-2 ess-safe-top">
        <div className="ess-glass mx-auto flex w-full max-w-lg items-center justify-between gap-2 rounded-[1.35rem] px-3 py-2 shadow-sm">
          <div className="flex min-h-11 min-w-0 flex-1 items-center">
            <BrandLogo variant="markSm" className="h-9 w-9 object-contain" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <DashboardThemeToggle />
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                if (!notificationsOpen) void refreshNotifications();
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--ess-muted)] hover:bg-[var(--ess-secondary-soft)]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <Link
              href="/ess/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ess-muted)] hover:bg-[var(--ess-secondary-soft)]"
              aria-label="Profile"
            >
              <User className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ess-muted)] hover:bg-[var(--ess-secondary-soft)]"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {notificationsOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[var(--ess-bg)] ess-safe-top">
          <div className="ess-glass mx-auto mt-2 flex w-[calc(100%-1rem)] max-w-2xl items-center justify-between rounded-full px-4 py-2">
            <h2 className="text-lg font-black text-[var(--ess-text)]">Notifications</h2>
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--ess-muted)] hover:bg-[var(--ess-secondary-soft)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-5">
            {notifications.length === 0 ? (
              <EssEmptyState title="No notifications yet" message="Important HR updates and workflow requests will appear here." />
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (n.unread) await markNotificationsRead([n.id]);
                        setNotificationsOpen(false);
                        if (n.href) router.push(n.href);
                      }}
                      className="w-full text-left"
                    >
                      <EssListItem
                        title={n.title}
                        subtitle={n.body}
                        meta={new Date(n.createdAt).toLocaleString()}
                        className={n.unread ? 'border-[var(--ess-primary)] bg-[var(--ess-primary-soft)]' : undefined}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="mx-auto w-full max-w-2xl p-4 ess-safe-bottom">
              <button
                type="button"
                onClick={async () => {
                  await markAllNotificationsRead();
                }}
                className="ess-btn-secondary w-full"
              >
                Mark all read
              </button>
            </div>
          )}
        </div>
      )}

      <main className="mx-auto w-full max-w-lg px-4 py-6 ess-main-pad">{children}</main>
      <EssTabBar />
    </div>
  );
}

export function EssShell({ children, brand, themeStyle }: { children: ReactNode; brand: EssShellBrand; themeStyle?: CSSProperties }) {
  return (
    <EssAppProvider>
      <EssServiceWorkerRegister />
      <EssShellInner brand={brand} themeStyle={themeStyle}>{children}</EssShellInner>
    </EssAppProvider>
  );
}
