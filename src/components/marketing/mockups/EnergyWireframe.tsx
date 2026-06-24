'use client';

import { DEMO_ENERGY_HSE } from './demo-data';

export function EnergyWireframe({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {DEMO_ENERGY_HSE.entities.map((entity) => (
            <span
              key={entity}
              className={`rounded-md border px-2 py-0.5 text-[8px] font-medium ${
                entity === DEMO_ENERGY_HSE.activeEntity
                  ? 'border-[var(--sc-coral)]/40 bg-[var(--sc-coral)]/15 text-[#FF8A6E]'
                  : 'border-white/10 bg-white/[0.04] text-white/50'
              }`}
            >
              {entity}
            </span>
          ))}
        </div>
        <div className="flex gap-2 text-[8px]">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-200">
            {DEMO_ENERGY_HSE.openCount} open
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/50">
            {DEMO_ENERGY_HSE.closedCount} closed
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {DEMO_ENERGY_HSE.incidents.map((incident) => (
          <div
            key={incident.id}
            className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[9px] font-semibold text-white/90">{incident.id}</p>
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-amber-200">
                {incident.status}
              </span>
            </div>
            <p className="mt-0.5 text-[8px] text-white/55">{incident.location}</p>
            <p className="mt-1 text-[7px] text-white/40">Severity · {incident.severity}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
