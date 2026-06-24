'use client';

import { DEMO_CORE_EMPLOYEES, DEMO_CORE_STATS, DEMO_TENANT } from './demo-data';

const PRIMARY_STATS = [
  {
    label: 'Active staff',
    value: String(DEMO_CORE_STATS.activeStaff),
    sub: DEMO_CORE_STATS.activeStaffHint,
  },
  {
    label: 'On duty today',
    value: String(DEMO_CORE_STATS.onDutyToday),
    sub: DEMO_CORE_STATS.onDutyHint,
  },
  {
    label: 'Leave pending',
    value: String(DEMO_CORE_STATS.leavePending),
    sub: DEMO_CORE_STATS.leaveHint,
  },
  {
    label: 'Payroll due',
    value: `${DEMO_TENANT.currency} ${DEMO_CORE_STATS.payrollDue}`,
    sub: DEMO_CORE_STATS.payrollHint,
  },
] as const;

const SECONDARY_STATS = [
  { label: 'Compliance', value: DEMO_CORE_STATS.compliance, sub: DEMO_CORE_STATS.complianceHint },
  { label: 'Modules live', value: String(DEMO_CORE_STATS.modulesLive), sub: DEMO_CORE_STATS.modulesHint },
] as const;

export function CoreDashboardWireframe({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold text-white/90">{DEMO_TENANT.name}</p>
          <p className="text-[8px] text-white/40">
            {DEMO_TENANT.hq} HQ · {DEMO_TENANT.region}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--sc-coral)]/20 px-2 py-0.5 text-[8px] font-medium text-[#FF8A6E]">
          Run payroll
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]">
        <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
          {PRIMARY_STATS.map((stat) => (
            <div key={stat.label} className="px-2 py-2">
              <p className="text-[7px] font-semibold uppercase tracking-wide text-white/35">
                {stat.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-none text-white">{stat.value}</p>
              <p className="mt-0.5 text-[7px] text-white/40">{stat.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/[0.06] border-t border-white/[0.06]">
          {SECONDARY_STATS.map((stat) => (
            <div key={stat.label} className="px-2 py-1.5">
              <p className="text-[7px] font-semibold uppercase tracking-wide text-white/35">
                {stat.label}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-white">{stat.value}</p>
              <p className="text-[7px] text-white/40">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
        <p className="mb-1.5 text-[7px] font-semibold uppercase tracking-wide text-white/35">
          People & workforce
        </p>
        <ul className="space-y-1">
          {DEMO_CORE_EMPLOYEES.map((person) => (
            <li
              key={person.name}
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1"
            >
              <span className="truncate text-[9px] font-medium text-white/85">{person.name}</span>
              <span className="shrink-0 text-[8px] text-white/45">{person.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
