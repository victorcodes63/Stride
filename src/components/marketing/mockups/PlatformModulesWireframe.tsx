'use client';

import {
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Gavel,
  Landmark,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { DEMO_PLATFORM_OVERVIEW, DEMO_TENANT } from './demo-data';

const MODULE_ICONS = {
  finance: Landmark,
  'hr-payroll': Users,
  legal: Gavel,
  procurement: ShoppingCart,
  admin: Building2,
  projects: ClipboardList,
} as const;

const SNAPSHOT_TONE: Record<
  (typeof DEMO_PLATFORM_OVERVIEW.snapshot)[number]['tone'],
  string
> = {
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-100',
  emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
  violet: 'border-violet-500/25 bg-violet-500/10 text-violet-100',
  primary: 'border-[var(--sc-coral)]/30 bg-[var(--sc-coral)]/10 text-[#FF8A6E]',
};

type PlatformModulesWireframeProps = {
  className?: string;
};

/** Platform hero — module command center + business snapshot with seeded demo data. */
export function PlatformModulesWireframe({ className = '' }: PlatformModulesWireframeProps) {
  const { greeting, modules, snapshot, shortcuts } = DEMO_PLATFORM_OVERVIEW;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12100E] text-left ${className}`.trim()}
      role="img"
      aria-label="Stride platform overview — six modules on one login with live business snapshot"
    >
      {/* Greeting */}
      <div
        className="border-b border-white/[0.06] px-4 py-4 sm:px-5 sm:py-5"
        style={{
          background: 'linear-gradient(135deg, #FF5436 0%, #E63E22 55%, #C9341B 100%)',
        }}
      >
        <p className="text-lg font-semibold tracking-tight text-white sm:text-xl">{greeting}</p>
        <p className="mt-1 text-[11px] text-white/80 sm:text-xs">
          {DEMO_TENANT.name} · {DEMO_TENANT.hq} HQ · {DEMO_TENANT.entityCount} entities
        </p>
      </div>

      <div className="space-y-4 p-3 sm:space-y-5 sm:p-4">
        {/* Module command center */}
        <section>
          <div className="mb-2.5 flex items-end justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-semibold text-white/90 sm:text-xs">
                Across your business
              </h3>
              <p className="mt-0.5 text-[9px] text-white/40 sm:text-[10px]">
                What needs you today, by module
              </p>
            </div>
            <span className="hidden text-[9px] text-white/35 sm:inline">6 modules live</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
            {modules.map((mod) => {
              const Icon = MODULE_ICONS[mod.id as keyof typeof MODULE_ICONS] ?? Briefcase;
              const needsAction = mod.attention > 0;

              return (
                <div
                  key={mod.id}
                  className={`rounded-lg border p-2.5 sm:p-3 ${
                    needsAction
                      ? 'border-amber-500/30 bg-amber-500/[0.07]'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-white/70">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </span>
                    {needsAction ? (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-amber-200">
                        {mod.attention}
                      </span>
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                    )}
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-white/90 sm:text-[11px]">
                    {mod.label}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {mod.lines.map((line) => (
                      <li key={line} className="text-[9px] leading-snug text-white/50 sm:text-[10px]">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Business snapshot */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold text-white/90 sm:text-xs">Business snapshot</h3>
            <p className="text-[9px] text-white/35">One signal per module</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
            {snapshot.map((tile) => (
              <div
                key={tile.label}
                className={`rounded-lg border px-2.5 py-2 sm:px-3 sm:py-2.5 ${SNAPSHOT_TONE[tile.tone]}`}
              >
                <p className="text-[9px] font-medium uppercase tracking-wide opacity-80">
                  {tile.label}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums leading-none sm:text-2xl">
                  {tile.value}
                </p>
                <p className="mt-1 text-[9px] opacity-75 sm:text-[10px]">{tile.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Jump shortcuts — gives bottom of frame context */}
        <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 sm:p-3">
          <h3 className="text-[10px] font-semibold text-white/70 sm:text-[11px]">Jump to a module</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shortcuts.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1"
              >
                <span className="text-[9px] font-medium text-white/80 sm:text-[10px]">{item.label}</span>
                <span className="text-[8px] text-white/40">{item.detail}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
