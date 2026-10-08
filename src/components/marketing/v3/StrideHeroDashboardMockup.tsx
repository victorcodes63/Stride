'use client';

import {
  Bell,
  CalendarDays,
  Clock,
  HelpCircle,
  LayoutGrid,
  Moon,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { STRIDE_MARK_SRC } from '@/lib/brand-constants';
import { MARKETING_BRAND, marketingAppHostLabel } from '@/lib/marketing-config';

/** Marketing-only demo tenant for the homepage hero — HR consultancy, not logistics. */
const HERO_TENANT = {
  name: 'Amani People Partners',
  module: 'HR & Payroll',
  user: 'Amina Njeri',
  email: 'admin@amanipeople.co.ke',
} as const;

const NAV = [
  { label: 'Overview', active: true },
  { label: 'People', active: false },
  { label: 'Recruitment', active: false },
  { label: 'Time & Attendance', active: false },
  { label: 'Payroll', active: false },
  { label: 'Development', active: false },
  { label: 'Employee self-service', active: false },
] as const;

const STATS = [
  { label: 'Total staff', value: '120', hint: 'Active workforce', icon: Users, hot: false },
  { label: 'On duty today', value: '112', hint: 'Clocked in', icon: Clock, hot: false },
  { label: 'Leave pending', value: '4', hint: 'Needs approval', icon: CalendarDays, hot: true },
  { label: 'Attendance exceptions', value: '3', hint: 'Open today', icon: ShieldCheck, hot: true },
] as const;

const LEAVE_QUEUE = [
  { initials: 'AO', name: 'Amina Otieno', detail: 'Annual leave · 3 days · next week', status: 'Manager' },
  { initials: 'BK', name: 'Brian Kamau', detail: 'Sick leave · Today · half day', status: 'Pending' },
  { initials: 'FW', name: 'Faith Wanjiru', detail: 'Comp day · Tomorrow', status: 'Pending' },
] as const;

const WORKSPACES = [
  { title: 'People', items: ['Employees', 'Onboarding', 'Departments'] },
  { title: 'Time & leave', items: ['Attendance', 'Leave', 'Rota'] },
  { title: 'Payroll & recruitment', items: ['Payroll runs', 'Jobs & ATS', 'Performance'] },
] as const;

function StrideMarkIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={STRIDE_MARK_SRC}
      alt=""
      aria-hidden
      className={`object-contain ${className}`.trim()}
      decoding="async"
    />
  );
}

/**
 * Homepage hero product preview — People & workforce (HR & Payroll),
 * composed to match the live module home without the logistics demo tenant.
 */
export function StrideHeroDashboardMockup() {
  return (
    <div
      className="sc-hero-mockup overflow-hidden rounded-t-[18px] text-left shadow-[0_20px_60px_rgba(26,23,20,0.18)] ring-1 ring-black/10"
      style={{ backgroundColor: '#12100E' }}
      role="img"
      aria-label={`${HERO_TENANT.name} on Stride: People & workforce — HR, leave, attendance and payroll`}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5"
        style={{ backgroundColor: '#1C1916' }}
      >
        <span className="h-2 w-2 rounded-full bg-[#FF5F57] sm:h-2.5 sm:w-2.5" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E] sm:h-2.5 sm:w-2.5" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#28C840] sm:h-2.5 sm:w-2.5" aria-hidden />
        <div
          className="mx-auto flex min-w-0 flex-1 items-center justify-center rounded-md px-3 py-0.5 text-[10px] text-white/55 sm:min-w-[220px] sm:px-8 sm:py-1 sm:text-[11px]"
          style={{ backgroundColor: '#12100E' }}
        >
          <span className="truncate">
            {marketingAppHostLabel()}/dashboard/people
          </span>
        </div>
      </div>

      <div className="flex min-h-0">
        {/* Sidebar */}
        <aside
          className="hidden w-[168px] shrink-0 flex-col border-r border-white/[0.06] px-2.5 py-3 sm:flex"
          style={{ backgroundColor: '#161311' }}
        >
          <div className="mb-4 flex items-center gap-2 px-1.5">
            <StrideMarkIcon className="h-6 w-6" />
            <span className="text-[11px] font-semibold tracking-tight text-[var(--sc-coral,#FF5436)]">
              stride
            </span>
          </div>

          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.label}>
                <span
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                    item.active
                      ? 'bg-[var(--sc-coral,#FF5436)] font-semibold text-white'
                      : 'text-white/55'
                  }`}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-white/80">
                AN
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium text-white/80">{HERO_TENANT.user}</p>
                <p className="truncate text-[9px] text-white/35">Administrator</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col" style={{ backgroundColor: '#12100E' }}>
          {/* Top bar */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 sm:gap-3 sm:px-4">
            <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/40 sm:flex">
              <Search className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Search employees, leave, payroll…</span>
              <span className="ml-auto rounded border border-white/10 px-1 py-0.5 text-[9px] text-white/30">
                ⌘K
              </span>
            </div>
            <span className="hidden rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-medium text-white/75 sm:inline">
              {HERO_TENANT.module}
            </span>
            <span className="hidden max-w-[9.5rem] truncate rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-medium text-white/75 sm:inline">
              {HERO_TENANT.name}
            </span>
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white sm:ml-0"
              style={{ backgroundColor: MARKETING_BRAND.coral }}
            >
              <UserPlus className="h-3 w-3" aria-hidden />
              Add employee
            </span>
            <Moon className="hidden h-3.5 w-3.5 text-white/40 sm:block" aria-hidden />
            <HelpCircle className="hidden h-3.5 w-3.5 text-white/40 sm:block" aria-hidden />
            <span className="relative hidden sm:inline">
              <Bell className="h-3.5 w-3.5 text-white/40" aria-hidden />
              <span
                className="absolute -right-1 -top-1 h-2 w-2 rounded-full"
                style={{ backgroundColor: MARKETING_BRAND.coral }}
              />
            </span>
          </div>

          <div className="space-y-3 px-3 py-3 sm:px-4 sm:py-4">
            {/* Coral People hero */}
            <div
              className="relative overflow-hidden rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
              style={{ backgroundColor: MARKETING_BRAND.coral }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full bg-white/15 blur-3xl"
                aria-hidden
              />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                    01 — HR & Payroll
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white">
                    Live
                  </span>
                  <p className="mt-2 flex items-center gap-2 text-[1.15rem] font-semibold tracking-tight text-white sm:text-[1.35rem]">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                      <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    People & workforce
                  </p>
                  <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-white/88 sm:text-[12px]">
                    Headcount, leave, time and payroll — one employee record for every client workforce.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A1714] px-3 py-2 text-[11px] font-semibold text-white">
                    <UserPlus className="h-3.5 w-3.5" aria-hidden />
                    Add employee
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    Review leave
                  </span>
                </div>
              </div>
            </div>

            {/* At a glance */}
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
                At a glance
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STATS.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 sm:p-3"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[9px] font-medium text-white/45">{stat.label}</span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-md ${
                            stat.hot ? 'bg-[var(--sc-coral,#FF5436)]/20 text-[var(--sc-coral,#FF5436)]' : 'bg-white/5 text-white/40'
                          }`}
                        >
                          <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                        </span>
                      </div>
                      <p className="mt-2 text-[1.25rem] font-semibold leading-none tracking-tight text-white tabular-nums">
                        {stat.value}
                      </p>
                      <p className={`mt-1 text-[9px] ${stat.hot ? 'text-[var(--sc-coral,#FF5436)]' : 'text-white/40'}`}>
                        {stat.hint}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leave + workspaces */}
            <div className="hidden gap-2.5 sm:grid sm:grid-cols-[1.25fr_1fr]">
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                  <div>
                    <p className="text-[11px] font-semibold text-white/90">Leave approvals</p>
                    <p className="text-[9px] text-white/40">Posts into the next payroll run</p>
                  </div>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                    style={{ backgroundColor: MARKETING_BRAND.coral }}
                  >
                    4 open
                  </span>
                </div>
                <ul className="divide-y divide-white/[0.05]">
                  {LEAVE_QUEUE.map((row) => (
                    <li key={row.name} className="flex items-center gap-2.5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-white/80">
                        {row.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[11px] font-medium text-white/85">{row.name}</p>
                          <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wide text-white/35">
                            {row.status}
                          </span>
                        </div>
                        <p className="truncate text-[9px] text-white/40">{row.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {WORKSPACES.map((group) => (
                  <div
                    key={group.title}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
                      {group.title}
                    </p>
                    <p className="mt-1 truncate text-[10px] text-white/65">{group.items.join(' · ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
