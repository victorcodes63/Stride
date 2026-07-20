'use client';

import { useRouter } from 'next/navigation';
import { BarChart3, CalendarClock, LayoutDashboard } from 'lucide-react';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

export type LegalTabKey = 'overview' | 'analytics' | 'calendar';

const TAB_HREF: Record<LegalTabKey, string> = {
  overview: '/dashboard/legal',
  analytics: '/dashboard/legal/analytics',
  calendar: '/dashboard/legal/calendar',
};

/** Shared Overview / Analytics / Calendar navigation for the Legal module hub pages. */
export function LegalModuleTabs({ active }: { active: LegalTabKey }) {
  const router = useRouter();
  return (
    <DashboardTabs<LegalTabKey>
      embedded
      value={active}
      onChange={(next) => {
        if (next !== active) router.push(TAB_HREF[next]);
      }}
      items={[
        { value: 'overview', label: 'Overview', icon: LayoutDashboard },
        { value: 'analytics', label: 'Analytics', icon: BarChart3 },
        { value: 'calendar', label: 'Calendar', icon: CalendarClock },
      ]}
    />
  );
}
