'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  ArrowUpRight,
  ChartBar,
  Check,
  CurrencyCircleDollar,
  DeviceMobile,
  Money,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION_EASE, Reveal } from '@/components/marketing/motion';
import { EditorialSectionHead } from '@/components/marketing/editorial/EditorialSectionHead';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import {
  CORE_CAPABILITIES,
  CORE_CAPABILITIES_BAND,
  INDUSTRY_DEEP_DIVES,
  STRIDE_VS_ALTERNATIVE,
  type IndustryDeepDive,
} from './industries-content';
import { IndustryMediaMotif } from './IndustryMediaMotif';

const TOTAL = 4;

function statusLabel(status: IndustryDeepDive['status']) {
  return status === 'available' ? 'Live' : 'Roadmap';
}

function statusChip(status: IndustryDeepDive['status']) {
  return status === 'available'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-[var(--sc-paper-2)] text-[var(--sc-ink-muted)]';
}

/* ---------------- 01 · Sector index (plat-form "Our Work" list + sticky preview) ---------------- */

export function IndustriesSectorIndex() {
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const activeIndustry = INDUSTRY_DEEP_DIVES[active]!;

  return (
    <section className="border-t border-[var(--sc-line)] bg-white py-24 sm:py-28 lg:py-32" aria-labelledby="industries-index-heading">
      <StudioCraftContainer>
        <EditorialSectionHead
          id="industries-index-heading"
          index="01"
          total={TOTAL}
          label="Sectors"
          title={
            <>
              Pick your sector. <span className="text-[var(--sc-coral)]">The core comes with it.</span>
            </>
          }
          note="Every pack runs on Stride Core, so HR, payroll and finance are already there when you switch one on."
        />

        <div className="mt-14 grid gap-10 lg:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-14">
          <ol>
            {INDUSTRY_DEEP_DIVES.map((industry, index) => {
              const isActive = index === active;
              return (
                <li key={industry.id}>
                  <a
                    href={`#${industry.id}`}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 border-t border-[var(--sc-line)] py-6 sm:grid-cols-[64px_minmax(0,1fr)_auto]"
                  >
                    <span className={`text-[15px] font-medium transition-colors ${isActive ? 'text-[var(--sc-coral)]' : 'text-[var(--sc-ink-subtle)]'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-[clamp(1.5rem,2.4vw,2rem)] font-medium leading-tight tracking-[-0.025em] transition-colors ${
                          isActive ? 'text-[var(--sc-coral)]' : 'text-[var(--sc-ink)]'
                        }`}
                      >
                        {industry.name}
                      </span>
                      <span className="mt-1 block text-[14px] leading-snug text-[var(--sc-ink-muted)]">{industry.positioning}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`hidden rounded-full px-2.5 py-1 text-[12px] font-semibold sm:inline ${statusChip(industry.status)}`}>
                        {statusLabel(industry.status)}
                      </span>
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                          isActive
                            ? 'border-[var(--sc-coral)] bg-[var(--sc-coral)] text-white'
                            : 'border-[var(--sc-line)] bg-white text-[var(--sc-ink)]'
                        }`}
                        aria-hidden
                      >
                        <ArrowUpRight size={16} weight="bold" />
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
            <li className="border-t border-[var(--sc-line)]" aria-hidden />
          </ol>

          {/* Sticky preview of the hovered sector (desktop). */}
          <div className="hidden lg:block">
            <div className="sticky top-[calc(var(--nav-h)+2rem)] rounded-[28px] bg-[var(--sc-ink)] p-3 shadow-[0_40px_90px_-40px_rgba(26,23,20,0.7)]">
              <div className="relative overflow-hidden rounded-[20px] bg-[var(--sc-paper-2)] p-3 sm:p-4">
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.16),transparent)]"
                  aria-hidden
                />
                <motion.div
                  key={activeIndustry.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: MOTION_EASE }}
                  className="relative"
                >
                  <IndustryMediaMotif mediaKey={activeIndustry.mediaKey} />
                </motion.div>
              </div>
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <p className="text-[14px] font-medium text-white">{activeIndustry.name}</p>
                <p className="text-[13px] text-white/50">
                  {String(active + 1).padStart(2, '0')} / {String(INDUSTRY_DEEP_DIVES.length).padStart(2, '0')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- 02 · Deep dives ---------------- */

const DEEP_DIVE_ROWS: { key: 'pain' | 'strideRuns' | 'opportunity'; label: string }[] = [
  { key: 'pain', label: 'The problem' },
  { key: 'strideRuns', label: 'What Stride runs' },
  { key: 'opportunity', label: 'Why it matters' },
];

function IndustryDeepDive({ industry, index }: { industry: IndustryDeepDive; index: number }) {
  const mediaRight = index % 2 === 0;
  return (
    <article
      id={industry.id}
      className="scroll-mt-28 border-t border-[var(--sc-line)] py-16 first:border-t-0 first:pt-0 sm:py-20"
      aria-labelledby={`industry-${industry.id}-title`}
    >
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className={mediaRight ? 'lg:order-2' : ''}>
          <div className="rounded-[24px] bg-[var(--sc-ink)] p-3 shadow-[0_30px_70px_-36px_rgba(26,23,20,0.6)]">
            <IndustryMediaMotif mediaKey={industry.mediaKey} />
          </div>
        </Reveal>

        <div className={mediaRight ? 'lg:order-1' : ''}>
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-medium text-[var(--sc-coral)]">{String(index + 1).padStart(2, '0')}</span>
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusChip(industry.status)}`}>
                {statusLabel(industry.status)}
              </span>
            </div>
            <h3
              id={`industry-${industry.id}-title`}
              className="mt-4 text-[clamp(2rem,4.2vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.022em] text-[var(--sc-ink)]"
            >
              {industry.name}
            </h3>
            <p className="mt-3 text-[17px] leading-[1.6] text-[var(--sc-coral)]">{industry.positioning}</p>
          </Reveal>

          <dl className="mt-8">
            {DEEP_DIVE_ROWS.map((row, rowIndex) => (
              <Reveal key={row.key} delay={0.05 * (rowIndex + 1)}>
                <div className="grid gap-2 border-t border-[var(--sc-line)] py-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-ink-subtle)]">{row.label}</dt>
                  <dd className="text-[15px] leading-[1.7] text-[var(--sc-ink-muted)]">{industry[row.key]}</dd>
                </div>
              </Reveal>
            ))}
          </dl>

          <Reveal delay={0.2}>
            <div className="mt-6">
              <MarketingPrimaryLink href={industry.href} label={industry.ctaLabel} variant="coral" showArrow />
            </div>
          </Reveal>
        </div>
      </div>
    </article>
  );
}

export function IndustriesDeepDives() {
  return (
    <section className="bg-[var(--sc-paper-2)] py-24 sm:py-28 lg:py-32" aria-labelledby="industries-deep-heading">
      <StudioCraftContainer>
        <EditorialSectionHead
          id="industries-deep-heading"
          index="02"
          total={TOTAL}
          label="Sector by sector"
          title={
            <>
              What each pack <span className="text-[var(--sc-coral)]">actually runs.</span>
            </>
          }
          note="The problem we hear in each sector, the workflow Stride runs for it, and why it matters."
        />
        <div className="mt-14 rounded-[28px] bg-white p-6 shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-34px_rgba(26,23,20,0.22)] sm:p-10 lg:mt-20 lg:p-14">
          {INDUSTRY_DEEP_DIVES.map((industry, index) => (
            <IndustryDeepDive key={industry.id} industry={industry} index={index} />
          ))}
        </div>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- 03 · Core (dark) ---------------- */

const CAPABILITY_ICONS: PhosphorIcon[] = [UsersThree, Money, CurrencyCircleDollar, DeviceMobile, ChartBar];

export function IndustriesCoreBand() {
  return (
    <section className="sc-on-ink relative overflow-hidden bg-[var(--sc-ink)] py-24 text-white sm:py-28 lg:py-32" aria-labelledby="industries-core-heading">
      <div
        className="pointer-events-none absolute right-[-10rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.16),transparent)]"
        aria-hidden
      />
      <StudioCraftContainer className="relative">
        <EditorialSectionHead
          tone="dark"
          id="industries-core-heading"
          index="03"
          total={TOTAL}
          label={CORE_CAPABILITIES_BAND.eyebrow}
          title={
            <>
              Every vertical <span className="text-[var(--sc-coral)]">inherits the core.</span>
            </>
          }
          note={CORE_CAPABILITIES_BAND.description}
        />
        <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:mt-20 lg:grid-cols-5">
          {CORE_CAPABILITIES.map((item, index) => {
            const Icon = CAPABILITY_ICONS[index] ?? UsersThree;
            return (
              <Reveal key={item} as="li" delay={Math.min(index * 0.05, 0.2)}>
                <div className="flex h-full min-h-[180px] flex-col rounded-[22px] border border-white/10 bg-white/[0.04] p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--sc-coral)]/15 text-[var(--sc-coral)]">
                      <Icon size={20} weight="duotone" aria-hidden />
                    </span>
                    <span className="text-[13px] text-white/35">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <p className="mt-auto pt-8 text-[17px] font-medium leading-snug text-white">{item}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- 04 · Stride vs the alternative ---------------- */

export function IndustriesComparison() {
  return (
    <section className="bg-white py-24 sm:py-28 lg:py-32" aria-labelledby="industries-vs-heading">
      <StudioCraftContainer>
        <EditorialSectionHead
          id="industries-vs-heading"
          index="04"
          total={TOTAL}
          label="Why one platform"
          title={
            <>
              Stride vs. <span className="text-[var(--sc-coral)]">the alternative.</span>
            </>
          }
          note="What changes when your sector workflows sit on the same records as HR, payroll and finance."
        />
        <div className="mt-14 grid gap-3 lg:mt-20 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[22px] border border-[var(--sc-line)] bg-[var(--sc-paper-2)] p-7 sm:p-9">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-ink-subtle)]">
                {STRIDE_VS_ALTERNATIVE.alternative.heading}
              </p>
              <ul className="mt-6">
                {STRIDE_VS_ALTERNATIVE.alternative.items.map((item) => (
                  <li key={item} className="flex items-center gap-3 border-t border-[var(--sc-line)] py-4 text-[16px] text-[var(--sc-ink-muted)]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[var(--sc-ink-subtle)]">
                      <X size={12} weight="bold" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="sc-on-ink h-full rounded-[22px] bg-[var(--sc-ink)] p-7 text-white shadow-[0_30px_70px_-36px_rgba(26,23,20,0.7)] sm:p-9">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-coral)]">
                {STRIDE_VS_ALTERNATIVE.stride.heading}
              </p>
              <ul className="mt-6">
                {STRIDE_VS_ALTERNATIVE.stride.items.map((item) => (
                  <li key={item} className="flex items-center gap-3 border-t border-white/10 py-4 text-[16px] text-white">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sc-coral)] text-white">
                      <Check size={12} weight="bold" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/platform"
                className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-white transition-colors hover:text-[var(--sc-coral)]"
              >
                Explore the platform <span aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
