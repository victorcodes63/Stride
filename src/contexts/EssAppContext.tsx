'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ModuleKey } from '@/lib/modules';
import { writeModuleAdminFlagsCookie } from '@/lib/module-cookie';
import { showEssTeamTab } from '@/lib/ess-nav-catalog';

export type EssMePayload = {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'hr';
  mustResetPassword: boolean;
  employee: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    employeeNumber: string | null;
    employmentStatus: string;
    dateOfJoining: string | null;
  } | null;
};

export type EssNotification = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  unread: boolean;
  createdAt: string;
};

type EssAppContextValue = {
  me: EssMePayload | null;
  meLoading: boolean;
  enabledModules: Record<ModuleKey, boolean>;
  showTeamTab: boolean;
  notifications: EssNotification[];
  unreadCount: number;
  refreshMe: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: (ids: string[]) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
};

const defaultModules: Record<ModuleKey, boolean> = {
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

const EssAppContext = createContext<EssAppContextValue | null>(null);

export function EssAppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<EssMePayload | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [enabledModules, setEnabledModules] = useState(defaultModules);
  const [notifications, setNotifications] = useState<EssNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshMe = useCallback(async () => {
    const res = await fetch('/api/ess/auth/me');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Unauthorized');
    setMe(data as EssMePayload);
  }, []);

  const refreshNotifications = useCallback(async () => {
    const res = await fetch('/api/ess/notifications?limit=30');
    if (!res.ok) return;
    const data = (await res.json()) as {
      notifications?: EssNotification[];
      unreadCount?: number;
    };
    setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshMe();
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config/deployment')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { modules?: Record<ModuleKey, boolean>; moduleAdminFlags?: Record<ModuleKey, boolean> } | null) => {
        if (!cancelled && data?.modules) {
          setEnabledModules(data.modules);
          if (data.moduleAdminFlags) writeModuleAdminFlagsCookie(data.moduleAdminFlags);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshNotifications();
    const interval = setInterval(() => void refreshNotifications(), 60_000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const markNotificationsRead = useCallback(
    async (ids: string[]) => {
      await fetch('/api/ess/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, unread: false } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - ids.length));
    },
    [],
  );

  const markAllNotificationsRead = useCallback(async () => {
    await fetch('/api/ess/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
  }, []);

  const showTeamTab = showEssTeamTab(me?.role);

  const value = useMemo(
    () => ({
      me,
      meLoading,
      enabledModules,
      showTeamTab,
      notifications,
      unreadCount,
      refreshMe,
      refreshNotifications,
      markNotificationsRead,
      markAllNotificationsRead,
    }),
    [
      me,
      meLoading,
      enabledModules,
      showTeamTab,
      notifications,
      unreadCount,
      refreshMe,
      refreshNotifications,
      markNotificationsRead,
      markAllNotificationsRead,
    ],
  );

  return <EssAppContext.Provider value={value}>{children}</EssAppContext.Provider>;
}

export function useEssApp() {
  const ctx = useContext(EssAppContext);
  if (!ctx) throw new Error('useEssApp must be used within EssAppProvider');
  return ctx;
}
