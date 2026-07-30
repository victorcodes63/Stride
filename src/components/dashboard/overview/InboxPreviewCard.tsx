'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, Loader2 } from 'lucide-react';

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  unread: boolean;
  createdAt: string;
  priority?: string | null;
};

function formatNotifTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function InboxPreviewCard({
  limit = 6,
  onUnreadChange,
}: {
  limit?: number;
  onUnreadChange?: (count: number) => void;
}) {
  const router = useRouter();
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const publishUnread = useCallback((count: number) => {
    setUnreadCount(count);
    onUnreadChangeRef.current?.(count);
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/notifications?limit=${limit}`, {
          credentials: 'include',
          signal,
        });
        if (!res.ok) throw new Error('Failed to load inbox');
        const data = (await res.json()) as {
          notifications?: NotificationItem[];
          unreadCount?: number;
        };
        const rows = Array.isArray(data.notifications) ? data.notifications : [];
        const unread = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
        setNotifications(rows);
        publishUnread(unread);
        setError(null);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setNotifications([]);
        setError(e instanceof Error ? e.message : 'Failed to load inbox');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [limit, publishUnread],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const markAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await fetch('/api/dashboard/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
      publishUnread(0);
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (n: NotificationItem) => {
    if (n.unread) {
      await fetch('/api/dashboard/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
      publishUnread(Math.max(0, unreadCount - 1));
    }
    if (n.href) router.push(n.href);
    else router.push('/dashboard/notifications');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="dash-icon-well flex h-8 w-8 items-center justify-center rounded-lg">
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Inbox</h3>
                {unreadCount > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-[var(--dash-text-muted)]">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You’re caught up'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={markingAll}
              className="text-[11px] font-medium text-[var(--dash-text-muted)] hover:text-primary-700 disabled:opacity-50 dark:hover:text-primary-400"
            >
              {markingAll ? '…' : 'Mark all'}
            </button>
          ) : null}
          <Link
            href="/dashboard/notifications"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400"
          >
            Open <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-8 text-sm text-[var(--dash-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-400"
            >
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
            <span className="dash-icon-well flex h-10 w-10 items-center justify-center rounded-xl">
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <p className="mt-3 text-sm font-medium text-[var(--dash-text-strong)]">No notifications yet</p>
            <p className="mt-1 max-w-[16rem] text-xs text-[var(--dash-text-muted)]">
              Approvals, contract alerts, and workflow updates will land here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--dash-border-subtle)]">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void openNotification(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-[var(--dash-hover)] ${
                    n.unread ? 'bg-[var(--dash-surface-muted)]/50' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        n.unread
                          ? 'font-semibold text-[var(--dash-text-strong)]'
                          : 'font-medium text-[var(--dash-text-strong)]'
                      }`}
                    >
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--dash-text-muted)]">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] tabular-nums text-[var(--dash-text-subtle)]">
                      {formatNotifTime(n.createdAt)}
                    </p>
                  </span>
                  {n.unread ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500"
                      aria-label="Unread"
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
