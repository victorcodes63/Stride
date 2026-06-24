import { STRIDE_MARK_SRC } from '@/lib/brand-constants';
import { MARKETING_BRAND, marketingAppHostLabel } from '@/lib/marketing-config';
import { DEMO_CORE_STATS, DEMO_TENANT } from './demo-data';

const KPI = [
  { label: 'Active staff', value: String(DEMO_CORE_STATS.activeStaff), sub: DEMO_CORE_STATS.activeStaffHint },
  { label: 'On duty today', value: String(DEMO_CORE_STATS.onDutyToday), sub: DEMO_CORE_STATS.onDutyHint },
  { label: 'Leave pending', value: String(DEMO_CORE_STATS.leavePending), sub: DEMO_CORE_STATS.leaveHint },
  {
    label: 'Payroll due',
    value: `${DEMO_TENANT.currency} ${DEMO_CORE_STATS.payrollDue}`,
    sub: DEMO_CORE_STATS.payrollHint,
  },
] as const;

export function DashboardMockup({ className = '' }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl shadow-[0_24px_60px_-24px_rgba(26,23,20,0.35)] ring-1 ring-black/10 ${className}`.trim()}
      style={{ backgroundColor: '#12100E' }}
    >
      <div
        className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2"
        style={{ backgroundColor: '#1C1916' }}
      >
        <span className="h-2 w-2 rounded-full bg-[#FF5F57]" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#28C840]" aria-hidden />
        <span className="ml-1 flex-1 rounded-md px-2 py-0.5 text-center text-[9px] text-white/45">
          {marketingAppHostLabel()}
        </span>
      </div>

      <div className="p-3 sm:p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: MARKETING_BRAND.coral }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={STRIDE_MARK_SRC}
                alt=""
                aria-hidden
                className="h-4 w-4 object-contain brightness-0 invert"
                decoding="async"
              />
            </span>
            <div>
              <p className="text-[10px] font-semibold text-white">Operations overview</p>
              <p className="text-[8px] text-white/40">
                {DEMO_TENANT.name} · {DEMO_TENANT.hq} HQ
              </p>
            </div>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[8px] font-semibold text-white"
            style={{ backgroundColor: MARKETING_BRAND.coral }}
          >
            Run payroll
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.025]">
          <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-y-0">
            {KPI.map((item) => (
              <div key={item.label} className="px-2 py-2 sm:px-2.5">
                <p className="text-[7px] font-semibold uppercase tracking-wide text-white/35">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-none text-white">{item.value}</p>
                <p className="mt-0.5 text-[7px] text-white/40">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
