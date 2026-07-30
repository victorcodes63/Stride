'use client';

import Link from 'next/link';
import { CalendarOff, ChevronRight, UserCog } from 'lucide-react';
import { OverviewWidgetHeader } from '@/components/dashboard/overview/OverviewWidgetHeader';
import { MyTasksCountsCard } from '@/components/dashboard/overview/MyTasksCountsCard';
import { InboxPreviewCard } from '@/components/dashboard/overview/InboxPreviewCard';
import { MyCalendarCompactCard } from '@/components/dashboard/overview/MyCalendarCompactCard';

const QUICK_LINKS = [
  {
    href: '/dashboard/staff-leave?tab=my',
    label: 'My leave',
    desc: 'Request and track personal leave',
    icon: CalendarOff,
  },
  {
    href: '/dashboard/people/me',
    label: 'My profile',
    desc: 'Your staff profile & settings',
    icon: UserCog,
  },
] as const;

export function PersonalPlanningSection({
  onUnreadChange,
}: {
  onUnreadChange?: (count: number) => void;
}) {
  return (
    <section className="dashboard-panel group/pin-target overflow-hidden">
      <OverviewWidgetHeader
        widgetId="personal-planning"
        title="Plan my work"
        trailing={
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--dash-text-subtle)]">
            Tasks · Inbox · Calendar
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:px-3 lg:grid-cols-3">
        <MyTasksCountsCard />
        <InboxPreviewCard limit={6} onUnreadChange={onUnreadChange} />
        <MyCalendarCompactCard />
      </div>

      <div className="border-t border-[var(--dash-border-subtle)] px-2 py-2 sm:px-3">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="dash-overview-row-link group">
                <span className="dash-icon-well flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--dash-text-strong)]">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--dash-text-muted)]">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dash-text-faint)] transition group-hover:text-[var(--dash-text-muted)]" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
