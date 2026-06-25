'use client';

import { DEMO_STATUTORY } from './demo-data';

export function StatutoryWireframe({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wide text-white/40">
            {DEMO_STATUTORY.tenantName}
          </p>
          <p className="text-sm font-semibold leading-tight text-white">
            Statutory · {DEMO_STATUTORY.period}
          </p>
          <p className="mt-0.5 text-[8px] text-white/45">
            {DEMO_STATUTORY.employeeCount.toLocaleString()} employees
          </p>
        </div>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-emerald-200">
          Filed
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/[0.06] px-2 py-1.5 text-[7px] font-semibold uppercase tracking-wide text-white/35">
          <span>Statutory</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {DEMO_STATUTORY.rows.map((row) => (
            <li
              key={row.label}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5"
            >
              <span className="text-[9px] font-medium text-white/85">{row.label}</span>
              <span className="font-mono text-[8px] text-white/55">{row.amount}</span>
              <span className="text-[8px] font-medium text-emerald-200">{row.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
