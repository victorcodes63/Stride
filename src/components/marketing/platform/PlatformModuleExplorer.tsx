'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  Bank,
  ChartLineUp,
  Check,
  Gear,
  Handshake,
  Kanban,
  Scales,
  ShoppingCart,
  SquaresFour,
  Truck,
  UsersThree,
} from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { MarketingModuleBadge } from '@/components/marketing/MarketingModuleBadge';
import { MOTION_EASE } from '@/components/marketing/motion';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { MARKETING_ROUTES, PLATFORM_MODULES } from '@/lib/marketing-config';

const AREA_ICONS: Record<string, PhosphorIcon> = {
  'HR & Payroll': UsersThree,
  Finance: Bank,
  Procurement: ShoppingCart,
  'Legal & Documents': Scales,
  Projects: Kanban,
  'Admin & Operations': Gear,
  'Fleet & Logistics': Truck,
  'HR Outsourcing': Handshake,
  Sales: ChartLineUp,
};

/** Areas included on every plan; everything else is a plug-in. */
const CORE_AREAS = new Set(['HR & Payroll', 'Finance']);

const CARD =
  'rounded-[20px] border border-[var(--sc-line)] bg-white shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-32px_rgba(26,23,20,0.22)]';

/** Explorer for every product area: list on the left, detail on the right. */
export function PlatformModuleExplorer() {
  const reduceMotion = useReducedMotion();
  const [activeName, setActiveName] = useState(PLATFORM_MODULES[0]!.name);
  const active = PLATFORM_MODULES.find((area) => area.name === activeName) ?? PLATFORM_MODULES[0]!;
  const ActiveIcon = AREA_ICONS[active.name] ?? SquaresFour;
  const isCore = CORE_AREAS.has(active.name);

  return (
    <section className="bg-white py-24 sm:py-28 lg:py-36" aria-labelledby="platform-modules-heading">
      <StudioCraftContainer>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
          <div>
            <SectionBadge label="Modules" />
            <h2
              id="platform-modules-heading"
              className="max-w-[760px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)] [text-wrap:balance]"
            >
              Core first. <span className="text-[var(--sc-coral)]">Plug-ins when you need them.</span>
            </h2>
          </div>
          <p className="text-[16px] leading-[1.7] text-[var(--sc-ink-muted)]">
            HR &amp; Payroll and Finance come with every plan. Switch on the rest as you grow, on the same login,
            records and approvals.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:gap-6">
          {/* Area list */}
          <div role="tablist" aria-label="Product areas" className={`${CARD} p-2`}>
            {PLATFORM_MODULES.map((area) => {
              const Icon = AREA_ICONS[area.name] ?? SquaresFour;
              const selected = area.name === active.name;
              return (
                <button
                  key={area.name}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveName(area.name)}
                  className={`group flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
                    selected ? 'bg-[var(--sc-ink)] text-white' : 'hover:bg-[var(--sc-paper-2)]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                      selected ? 'bg-[var(--sc-coral)] text-white' : 'bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]'
                    }`}
                  >
                    <Icon size={18} weight="duotone" aria-hidden />
                  </span>
                  <span className={`flex-1 text-[15px] font-medium ${selected ? 'text-white' : 'text-[var(--sc-ink)]'}`}>
                    {area.name}
                  </span>
                  {CORE_AREAS.has(area.name) ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        selected ? 'bg-white/15 text-white' : 'bg-[var(--sc-coral)]/10 text-[var(--sc-coral-deep)]'
                      }`}
                    >
                      Included
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <motion.div
            key={active.name}
            role="tabpanel"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: MOTION_EASE }}
            className={`${CARD} flex flex-col p-6 sm:p-9`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]">
                <ActiveIcon size={24} weight="duotone" aria-hidden />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-coral)]">
                  {isCore ? 'Included on every plan' : 'Plug-in module'}
                </p>
                <h3 className="text-[22px] font-medium tracking-[-0.02em] text-[var(--sc-ink)]">{active.name}</h3>
              </div>
              <MarketingModuleBadge readiness={active.readiness} />
            </div>

            <p className="mt-7 text-[clamp(1.375rem,2.2vw,1.75rem)] font-medium leading-[1.25] tracking-[-0.02em] text-[var(--sc-ink)] [text-wrap:balance]">
              {active.headline}
            </p>
            <p className="mt-4 max-w-[46rem] text-[16px] leading-[1.7] text-[var(--sc-ink-muted)]">{active.description}</p>

            <ul className="mt-8 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {active.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-[15px] leading-snug text-[var(--sc-ink)]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--sc-coral)]/12 text-[var(--sc-coral)]">
                    <Check size={12} weight="bold" aria-hidden />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            {active.modules.length > 0 ? (
              <div className="mt-auto pt-9">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-ink-subtle)]">
                  What&apos;s inside
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {active.modules.map((chip) => (
                    <span
                      key={chip.key}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--sc-line)] bg-[var(--sc-paper-2)] px-3 py-1.5 text-[13px] text-[var(--sc-ink)]"
                    >
                      {chip.label}
                      {chip.readiness !== 'live' ? (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--sc-ink-subtle)]">
                          {chip.readiness}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-[var(--sc-line)] pt-6">
              <Link
                href={MARKETING_ROUTES.contact}
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--sc-coral)] transition-colors hover:text-[var(--sc-coral-deep)]"
              >
                See {active.name} in a demo <span aria-hidden>→</span>
              </Link>
              {!isCore ? (
                <Link href={MARKETING_ROUTES.pricing} className="text-[14px] font-medium text-[var(--sc-ink-muted)] hover:text-[var(--sc-ink)]">
                  How plug-ins are priced
                </Link>
              ) : null}
            </div>
          </motion.div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
