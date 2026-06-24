'use client';

import { DEMO_CONSTRUCTION_SITES } from './demo-data';

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[7px] text-white/45">{label}</span>
        <span className="text-[7px] font-medium text-white/70">{value}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--sc-coral)]"
          style={{ width: `${value}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function ConstructionWireframe({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className}`.trim()}>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {DEMO_CONSTRUCTION_SITES.sites.map((site) => (
          <div
            key={site.name}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2"
          >
            <p className="mb-1.5 text-[9px] font-semibold text-white/85">{site.name}</p>
            <div className="space-y-1">
              <ProgressBar label="Foundation" value={site.foundation} />
              <ProgressBar label="Structure" value={site.structure} />
              <ProgressBar label="MEP" value={site.mep} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2">
        <p className="mb-1.5 text-[7px] font-semibold uppercase tracking-wide text-white/35">
          Plant utilisation
        </p>
        <div className="space-y-1">
          {DEMO_CONSTRUCTION_SITES.plant.map((item) => (
            <ProgressBar key={item.name} label={item.name} value={item.utilisation} />
          ))}
        </div>
      </div>
    </div>
  );
}
