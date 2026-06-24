'use client';

import {
  ArrowLeft,
  ArrowRight,
  Copy,
  LayoutGrid,
  Monitor,
  PanelLeft,
  Plus,
  RefreshCw,
  Share2,
  Users,
  Wallet,
  FolderKanban,
} from 'lucide-react';
import { STRIDE_MARK_SRC } from '@/lib/brand-constants';
import { MARKETING_BRAND, marketingAppHostLabel } from '@/lib/marketing-config';
import { DEMO_CORE_EMPLOYEES, DEMO_CORE_STATS, DEMO_TENANT } from '@/components/marketing/mockups/demo-data';

const STATS = [
  { label: 'Active staff', value: String(DEMO_CORE_STATS.activeStaff), sub: DEMO_CORE_STATS.activeStaffHint },
  { label: 'On duty today', value: String(DEMO_CORE_STATS.onDutyToday), sub: DEMO_CORE_STATS.onDutyHint },
  { label: 'Leave pending', value: String(DEMO_CORE_STATS.leavePending), sub: DEMO_CORE_STATS.leaveHint },
  {
    label: 'Payroll due',
    value: `${DEMO_TENANT.currency} ${DEMO_CORE_STATS.payrollDue}`,
    sub: DEMO_CORE_STATS.payrollHint,
  },
  { label: 'Compliance', value: DEMO_CORE_STATS.compliance, sub: DEMO_CORE_STATS.complianceHint },
  { label: 'Modules live', value: String(DEMO_CORE_STATS.modulesLive), sub: DEMO_CORE_STATS.modulesHint },
] as const;

const NAV = [
  { icon: LayoutGrid, label: 'Overview', active: true },
  { icon: Users, label: 'People', active: false },
  { icon: Wallet, label: 'Finance', active: false },
  { icon: FolderKanban, label: 'Projects', active: false },
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

export function StrideHeroDashboardMockup() {
  return (
    <div
      className="overflow-hidden rounded-t-[18px] text-left shadow-[0_-24px_80px_rgba(26,23,20,0.32)] ring-1 ring-black/10"
      style={{ backgroundColor: '#12100E' }}
    >
      {/* Safari chrome */}
      <div
        className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5"
        style={{ backgroundColor: '#1C1916' }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" aria-hidden />
        <PanelLeft className="ml-1.5 h-3.5 w-3.5 text-white/35" aria-hidden />
        <ArrowLeft className="h-3.5 w-3.5 text-white/20" aria-hidden />
        <ArrowRight className="h-3.5 w-3.5 text-white/20" aria-hidden />
        <div
          className="mx-auto flex min-w-[220px] items-center justify-center gap-1.5 rounded-md px-8 py-1 text-[11px] text-white/55"
          style={{ backgroundColor: '#12100E' }}
        >
          <Monitor className="h-3 w-3 shrink-0" aria-hidden />
          {marketingAppHostLabel()}
        </div>
        <RefreshCw className="h-3.5 w-3.5 text-white/35" aria-hidden />
        <Share2 className="h-3.5 w-3.5 text-white/35" aria-hidden />
        <Plus className="h-3.5 w-3.5 text-white/35" aria-hidden />
        <Copy className="h-3.5 w-3.5 text-white/35" aria-hidden />
      </div>

      <div className="flex min-h-[300px]">
        {/* Sidebar */}
        <aside
          className="flex w-[168px] shrink-0 flex-col border-r border-white/[0.06] px-3 py-4"
          style={{ backgroundColor: '#161311' }}
        >
          <div className="mb-5 flex items-center gap-2">
            <StrideMarkIcon className="h-7 w-7" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Stride
            </span>
          </div>

          <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: MARKETING_BRAND.coral }}
              >
                N
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-white/90">{DEMO_TENANT.name}</p>
                <p className="text-[9px] text-white/40">{DEMO_TENANT.hq} HQ</p>
              </div>
            </div>
          </div>

          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.label}>
                <span
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                    item.active
                      ? 'bg-white/[0.08] font-medium text-white'
                      : 'text-white/50'
                  }`}
                >
                  <item.icon
                    className={`h-3.5 w-3.5 shrink-0 ${item.active ? 'text-[var(--sc-coral,#FF5436)]' : ''}`}
                    aria-hidden
                  />
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
                <p className="truncate text-[10px] font-medium text-white/80">Amina Njeri</p>
                <p className="text-[9px] text-white/35">Administrator</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col px-5 py-4" style={{ backgroundColor: '#12100E' }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: MARKETING_BRAND.coral }}
              >
                <StrideMarkIcon className="h-6 w-6 brightness-0 invert" />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-tight text-white">
                  Operations overview
                </p>
                <p className="text-[11px] text-white/45">
                  {DEMO_TENANT.hq} HQ · {DEMO_TENANT.region}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-semibold text-white shadow-[0_8px_24px_rgba(255,84,54,0.35)]"
              style={{ backgroundColor: MARKETING_BRAND.coral }}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Run payroll
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
            <div className="grid grid-cols-3 divide-x divide-y divide-white/[0.06] sm:grid-cols-6 sm:divide-y-0">
              {STATS.map((stat) => (
                <div key={stat.label} className="px-3 py-3 sm:px-4 sm:py-4">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-xl font-semibold leading-none tracking-tight text-white sm:text-[26px]">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-[10px] text-white/40">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              People & workforce
            </p>
            <ul className="space-y-1.5">
              {DEMO_CORE_EMPLOYEES.map((person) => (
                <li
                  key={person.name}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5 text-[10px]"
                >
                  <span className="font-medium text-white/80">{person.name}</span>
                  <span className="text-white/45">{person.role}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { title: 'People', items: ['Employees', 'Onboarding', 'Departments'] },
              { title: 'Time & leave', items: ['Attendance', 'Leave', 'Rota'] },
              { title: 'Payroll', items: ['Payroll runs', 'Compliance', 'Payslips'] },
            ].map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  {group.title}
                </p>
                <ul className="space-y-1.5">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5 text-[10px] text-white/65"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
