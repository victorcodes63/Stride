'use client';

import { Check, X } from '@phosphor-icons/react';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { CORE_CAPABILITIES, CORE_CAPABILITIES_BAND, STRIDE_VS_ALTERNATIVE } from './industries-content';

export function CoreCapabilitiesBand() {
  return (
    <section className="border-y border-[var(--sc-line)] bg-[var(--sc-ink)] py-14 text-white sm:py-16 lg:py-20">
      <StudioCraftContainer>
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sc-coral)]">
            {CORE_CAPABILITIES_BAND.eyebrow}
          </p>
          <h2 className="mt-3 max-w-xl font-heading text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold tracking-[-0.03em] text-white">
            {CORE_CAPABILITIES_BAND.title}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">
            {CORE_CAPABILITIES_BAND.description}
          </p>
        </Reveal>

        <Stagger
          as="ul"
          className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          delayChildren={0.1}
        >
          {CORE_CAPABILITIES.map((item) => (
            <StaggerItem
              key={item}
              as="li"
              className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
            >
              <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--sc-coral)]" aria-hidden />
              <span className="text-sm font-medium text-white/90">{item}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}

function VsBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--sc-line)] bg-white text-[11px] font-bold uppercase tracking-wide text-[var(--sc-ink-subtle,#8A8076)] shadow-[0_4px_12px_rgba(26,23,20,0.08)] ${className}`.trim()}
      aria-hidden
    >
      vs
    </span>
  );
}

export function StrideVsAlternativeStrip() {
  return (
    <section className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-24">
      <StudioCraftContainer>
        <Reveal>
          <h2 className="text-center font-heading text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold tracking-[-0.03em] text-[var(--sc-ink)]">
            {STRIDE_VS_ALTERNATIVE.title}
          </h2>
        </Reveal>

        {/* Mobile — stacked cards with vs between */}
        <div className="mt-12 flex flex-col gap-6 sm:gap-8 lg:hidden">
          <Reveal className="rounded-2xl border border-[var(--sc-line)] bg-[var(--sc-paper-2)] p-6 sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sc-ink-subtle,#8A8076)]">
              {STRIDE_VS_ALTERNATIVE.alternative.heading}
            </h3>
            <ul className="mt-5 space-y-3">
              {STRIDE_VS_ALTERNATIVE.alternative.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--sc-ink-muted)]">
                  <X size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--sc-ink-subtle,#8A8076)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="flex justify-center">
            <VsBadge />
          </div>

          <Reveal
            delay={0.1}
            className="rounded-2xl border border-[var(--sc-coral)]/25 bg-white p-6 shadow-[0_16px_40px_-16px_rgba(255,84,54,0.2)] sm:p-8"
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sc-coral)]">
              {STRIDE_VS_ALTERNATIVE.stride.heading}
            </h3>
            <ul className="mt-5 space-y-3">
              {STRIDE_VS_ALTERNATIVE.stride.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-[var(--sc-ink)]">
                  <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--sc-coral)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Desktop — vs in its own gutter column, aligned with headings */}
        <Reveal delay={0.05} className="mt-12 hidden overflow-hidden rounded-2xl border border-[var(--sc-line)] lg:grid lg:grid-cols-[minmax(0,1fr)_3.75rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div className="col-start-1 row-start-1 border-b border-[var(--sc-line)] bg-[var(--sc-paper-2)] px-8 pb-5 pt-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sc-ink-subtle,#8A8076)]">
              {STRIDE_VS_ALTERNATIVE.alternative.heading}
            </h3>
          </div>

          <div className="col-start-2 row-start-1 row-span-2 flex justify-center border-x border-[var(--sc-line)] bg-white pt-8">
            <VsBadge />
          </div>

          <div className="col-start-3 row-start-1 border-b border-[var(--sc-line)] bg-white px-8 pb-5 pt-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sc-coral)]">
              {STRIDE_VS_ALTERNATIVE.stride.heading}
            </h3>
          </div>

          <div className="col-start-1 row-start-2 bg-[var(--sc-paper-2)] px-8 pb-8 pt-5">
            <ul className="space-y-3">
              {STRIDE_VS_ALTERNATIVE.alternative.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--sc-ink-muted)]">
                  <X size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--sc-ink-subtle,#8A8076)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="col-start-3 row-start-2 bg-white px-8 pb-8 pt-5 shadow-[inset_8px_0_24px_-20px_rgba(255,84,54,0.35)]">
            <ul className="space-y-3">
              {STRIDE_VS_ALTERNATIVE.stride.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-[var(--sc-ink)]">
                  <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--sc-coral)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </StudioCraftContainer>
    </section>
  );
}
