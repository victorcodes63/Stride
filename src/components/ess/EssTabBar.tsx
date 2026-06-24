'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clock3, Home, LayoutGrid, Receipt, type LucideIcon } from 'lucide-react';
import { useEssApp } from '@/contexts/EssAppContext';

type BottomAction = {
  href: string;
  label: string;
  icon: LucideIcon;
  module?: 'leave' | 'payroll' | 'time';
  match: (pathname: string) => boolean;
  primary?: boolean;
};

const bottomActions: BottomAction[] = [
  { href: '/ess', label: 'Home', icon: Home, match: (path) => path === '/ess' },
  { href: '/ess/payslips', label: 'Payslips', icon: Receipt, module: 'payroll', match: (path) => path.startsWith('/ess/payslips') },
  {
    href: '/ess/attendance/clock',
    label: 'Check in',
    icon: Clock3,
    module: 'time',
    primary: true,
    match: (path) => path.startsWith('/ess/attendance/clock'),
  },
  { href: '/ess/leave', label: 'Leave', icon: CalendarDays, module: 'leave', match: (path) => path.startsWith('/ess/leave') },
  { href: '/ess/more', label: 'More', icon: LayoutGrid, match: (path) => path.startsWith('/ess/more') },
];

export function EssTabBar() {
  const pathname = usePathname();
  const { enabledModules } = useEssApp();

  const tabs = bottomActions.filter((action) => !action.module || enabledModules[action.module]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 px-3 ess-tab-bar"
      aria-label="Primary"
    >
      <div className="ess-glass pointer-events-auto mx-auto mb-2 flex w-full max-w-lg justify-around rounded-[1.75rem] p-1.5 shadow-[var(--ess-shadow-float)]">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          if (tab.primary) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative -mt-5 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-black leading-tight text-[var(--ess-secondary)]"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ess-secondary)] text-white shadow-[0_16px_34px_rgba(15,23,42,0.25)] ring-4 ring-[var(--ess-surface)]">
                  <Icon className="h-7 w-7" strokeWidth={2.1} />
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] px-1 text-[10px] font-bold leading-tight transition-all sm:text-xs ${
                active
                  ? 'text-[var(--ess-secondary)]'
                  : 'text-[var(--ess-muted)] hover:bg-[var(--ess-secondary-soft)]'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
