'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Bell, Loader2 } from 'lucide-react';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { useDashboardSession } from '@/contexts/dashboard-session';

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  unread: boolean;
  createdAt: string;
};

type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  emailEnabled: true,
  whatsappEnabled: false,
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

export function DashboardNotificationsContent() {
  const router = useRouter();
  const { modules } = useDashboardSession();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [credentialsExpiring, setCredentialsExpiring] = useState(0);
  const [credentialsExpired, setCredentialsExpired] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [savingChannel, setSavingChannel] = useState<keyof NotificationPreferences | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notifRes, metricsRes] = await Promise.all([
        fetch('/api/dashboard/notifications?limit=50', { credentials: 'include' }),
        modules.core !== false
          ? fetch('/api/dashboard/overview?metricsOnly=1&slice=core', { credentials: 'include' })
          : Promise.resolve(null),
      ]);

      if (notifRes.ok) {
        const data = (await notifRes.json()) as {
          notifications?: NotificationItem[];
          unreadCount?: number;
          preferences?: Partial<NotificationPreferences>;
        };
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
        if (data.preferences) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
        }
      }

      if (metricsRes?.ok) {
        const metrics = (await metricsRes.json()) as {
          credentialsExpiring?: number;
          credentialsExpired?: number;
        };
        setCredentialsExpiring(metrics.credentialsExpiring ?? 0);
        setCredentialsExpired(metrics.credentialsExpired ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [modules.core]);

  useEffect(() => {
    void load();
  }, [load]);

  const markAllRead = async () => {
    await fetch('/api/dashboard/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
  };

  const updatePreference = async (channel: keyof NotificationPreferences, value: boolean) => {
    const previous = preferences;
    const next = { ...preferences, [channel]: value };
    setPreferences(next);
    setSavingChannel(channel);
    try {
      const res = await fetch('/api/dashboard/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [channel]: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = (await res.json()) as { preferences?: Partial<NotificationPreferences> };
      if (data.preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
    } catch {
      setPreferences(previous);
    } finally {
      setSavingChannel(null);
    }
  };

  const openNotification = async (n: NotificationItem) => {
    if (n.unread) {
      await fetch('/api/dashboard/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.href) router.push(n.href);
  };

  const showCredentialAlert =
    modules.core !== false && (credentialsExpiring > 0 || credentialsExpired > 0);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Notifications"
        description="Alerts triggered across workflows — leave, contracts, payroll, and compliance."
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="dash-btn-secondary rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {showCredentialAlert ? (
        <DashboardPageSection title="Compliance alerts">
          <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Credential compliance</p>
                <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                  {credentialsExpiring > 0 ? `${credentialsExpiring} expiring soon` : null}
                  {credentialsExpiring > 0 && credentialsExpired > 0 ? ' · ' : null}
                  {credentialsExpired > 0 ? `${credentialsExpired} expired` : null}
                </p>
                <Link
                  href={
                    credentialsExpired > 0
                      ? '/dashboard/credentials?status=expired'
                      : '/dashboard/credentials?status=expiring_soon'
                  }
                  className="mt-2 inline-flex text-xs font-medium text-amber-950 underline-offset-2 hover:underline dark:text-amber-100"
                >
                  Review credentials →
                </Link>
              </div>
            </div>
          </div>
        </DashboardPageSection>
      ) : null}

      <DashboardPageSection
        title="Notification preferences"
        description="Choose how you’d like to be notified. WhatsApp messages are sent to your employee phone number on file."
      >
        <div className="dashboard-panel divide-y divide-[var(--dash-border-subtle)] overflow-hidden">
          {([
            { key: 'inAppEnabled', label: 'In-app', hint: 'Show alerts in your dashboard inbox.' },
            { key: 'emailEnabled', label: 'Email', hint: 'Send notifications to your email address.' },
            {
              key: 'whatsappEnabled',
              label: 'WhatsApp',
              hint: 'Sent to your employee phone number on file.',
            },
          ] as const).map(({ key, label, hint }) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--dash-text-strong)]">{label}</span>
                <span className="mt-0.5 block text-xs text-[var(--dash-text-muted)]">{hint}</span>
              </span>
              <span className="flex items-center gap-2">
                {savingChannel === key ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--dash-text-muted)]" aria-hidden />
                ) : null}
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary-600"
                  checked={preferences[key]}
                  disabled={savingChannel !== null}
                  onChange={(e) => void updatePreference(key, e.target.checked)}
                />
              </span>
            </label>
          ))}
        </div>
      </DashboardPageSection>

      <DashboardPageSection
        title="Inbox"
        description={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
            : 'You’re caught up.'
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="sr-only">Loading notifications</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="dashboard-panel flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="dash-icon-well flex h-12 w-12 items-center justify-center rounded-xl">
              <Bell className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="mt-3 text-sm font-medium text-[var(--dash-text-strong)]">No notifications yet</p>
            <p className="mt-1 max-w-sm text-xs text-[var(--dash-text-muted)]">
              Contract reminders, approvals, and workflow alerts will appear here when they’re triggered.
            </p>
          </div>
        ) : (
          <ul className="dashboard-panel divide-y divide-[var(--dash-border-subtle)] overflow-hidden">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void openNotification(n)}
                  className={`flex w-full gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--dash-hover)] sm:px-5 ${
                    n.unread ? 'bg-[var(--dash-surface-muted)]/60' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--dash-text-strong)]">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-3 text-xs text-[var(--dash-text-muted)]">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] tabular-nums text-[var(--dash-text-subtle)]">
                      {formatNotifTime(n.createdAt)}
                    </p>
                  </span>
                  {n.unread ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="Unread" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DashboardPageSection>
    </DashboardPage>
  );
}
