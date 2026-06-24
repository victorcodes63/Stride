'use client';

import { DEMO_HEALTHCARE_ROTA } from './demo-data';

const SHIFT_STYLES: Record<string, string> = {
  AM: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  PM: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  OFF: 'border-white/10 bg-white/[0.04] text-white/35',
};

export function HealthcareWireframe({ className = '' }: { className?: string }) {
  const { wards, days, assignments, staff } = DEMO_HEALTHCARE_ROTA;

  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className}`.trim()}>
      <div className="flex flex-wrap gap-1.5">
        {staff.map((person) => (
          <span
            key={person.name}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] text-white/70"
          >
            {person.name} · {person.ward}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
        <div
          className="grid gap-px border-b border-white/[0.06] bg-white/[0.06]"
          style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="bg-[#12100E] px-2 py-1.5 text-[7px] font-semibold uppercase tracking-wide text-white/35">
            Ward
          </div>
          {days.map((day) => (
            <div
              key={day}
              className="bg-[#12100E] px-1 py-1.5 text-center text-[7px] font-semibold uppercase tracking-wide text-white/35"
            >
              {day}
            </div>
          ))}
        </div>
        {wards.map((ward, rowIndex) => (
          <div
            key={ward}
            className="grid gap-px bg-white/[0.06]"
            style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div className="bg-[#12100E] px-2 py-1.5 text-[8px] font-medium text-white/70">{ward}</div>
            {assignments[rowIndex].map((shift, colIndex) => (
              <div key={`${ward}-${days[colIndex]}`} className="bg-[#12100E] p-1">
                <span
                  className={`flex h-full items-center justify-center rounded border px-1 py-0.5 text-[7px] font-semibold ${SHIFT_STYLES[shift]}`}
                >
                  {shift}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
