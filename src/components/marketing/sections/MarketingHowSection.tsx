'use client';

import { HOW_IT_WORKS_STEPS } from '@/lib/marketing-config';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';

export function MarketingHowSection() {
  return (
    <section id="how" className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="5" label="How it works" />
        </Reveal>

        <Reveal delay={0.06}>
          <h2 className="max-w-[640px] text-[clamp(2rem,4.5vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
            Three steps to <span className="text-[var(--sc-coral)]">full speed.</span>
          </h2>
        </Reveal>

        <Stagger className="mt-12 grid gap-8 md:grid-cols-3 lg:mt-16 lg:gap-10" delayChildren={0.14}>
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <StaggerItem key={step.step}>
              <div
                className="border-t-2 border-[var(--sc-coral)] pt-6"
                style={{
                  borderColor: `color-mix(in srgb, var(--sc-coral, #ff5436) ${100 - i * 22}%, transparent)`,
                }}
              >
                <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-coral)]">
                  {step.step}
                </p>
                <h3 className="mb-3 text-xl font-medium leading-tight tracking-[-0.02em] text-[var(--sc-ink)]">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--sc-ink-muted)]">{step.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}
