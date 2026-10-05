'use client';

import Link from 'next/link';
import { CalendarOff, ChevronRight, UserCog } from 'lucide-react';
import { OverviewWidgetHeader } from '@/components/dashboard/overview/OverviewWidgetHeader';
import { MyTasksCountsCard } from '@/components/dashboard/overview/MyTasksCountsCard';
import { InboxPreviewCard } from '@/components/dashboard/overview/InboxPreviewCard';
import { MyCalendarCompactCard } from '@/components/dashboard/overview/MyCalendarCompactCard';
import { NeedsAttentionSection } from '@/components/dashboard/overview/NeedsAttentionSection';
import type { OverviewAttentionItem } from '@/lib/dashboard-overview-personalization';

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
  attentionItems = [],
  onUnreadChange,
}: {
  attentionItems?: OverviewAttentionItem[];
  onUnreadChange?: (count: number) => void;
}) {
  const showAttention = attentionItems.length > 0;

  return (
    <section className="space-y-3">
      <div className="dashboard-panel group/pin-target overflow-hidden">
        <OverviewWidgetHeader
          widgetId="personal-planning"
          title="Getting into work"
          description="Your queues, tasks, inbox, and calendar — start here."
        />
      </div>

      <div
        className={`grid grid-cols-1 gap-3 lg:grid-cols-2 ${
          showAttention ? 'xl:grid-cols-2' : 'xl:grid-cols-3'
        }`}
      >
        {showAttention ? (
          <div className="min-h-[22rem] lg:col-span-2 xl:col-span-1 xl:row-span-2">
            <NeedsAttentionSection items={attentionItems} />
          </div>
        ) : null}

        <div className="min-h-[22rem]">
          <MyTasksCountsCard />
        </div>

        <div className="min-h-[22rem]">
          <InboxPreviewCard limit={6} onUnreadChange={onUnreadChange} />
        </div>

        <div className={`min-h-[22rem] ${showAttention ? 'lg:col-span-2 xl:col-span-1' : ''}`}>
          <MyCalendarCompactCard />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="dash-overview-row-link group rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)] px-3 py-2.5"
            >
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
    </section>
  );
}
