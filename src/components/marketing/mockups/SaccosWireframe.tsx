'use client';

import { DEMO_SACCO_MEMBERS } from './demo-data';

export function SaccosWireframe({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wide text-white/40">
            {DEMO_SACCO_MEMBERS.tenantName}
          </p>
          <p className="text-lg font-semibold leading-none text-white">
            {DEMO_SACCO_MEMBERS.memberCount.toLocaleString()} members
          </p>
        </div>
        <div className="rounded-md border border-[var(--sc-coral)]/30 bg-[var(--sc-coral)]/10 px-2 py-1 text-right">
          <p className="text-[7px] font-semibold uppercase tracking-wide text-[#FF8A6E]">
            Dividend run
          </p>
          <p className="text-[9px] font-medium text-white/90">
            {DEMO_SACCO_MEMBERS.dividendRun.label} — {DEMO_SACCO_MEMBERS.dividendRun.status}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/[0.06] px-2 py-1.5 text-[7px] font-semibold uppercase tracking-wide text-white/35">
          <span>Member</span>
          <span>ID</span>
          <span>Shares</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {DEMO_SACCO_MEMBERS.rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5"
            >
              <span className="truncate text-[9px] font-medium text-white/85">{row.name}</span>
              <span className="font-mono text-[8px] text-white/45">{row.id}</span>
              <span className="text-[8px] font-medium text-[#FF8A6E]">{row.shares}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
