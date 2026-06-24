'use client';

import { Reveal } from '@/components/marketing/motion';
import { ComplianceBento } from '@/components/marketing/home/ComplianceBento';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { PLATFORM_PAGE } from '@/lib/marketing-config';

export function HomeComplianceBand() {
  const { compliance } = PLATFORM_PAGE;

  return (
    <section className="relative overflow-hidden border-y border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-16 sm:py-20 lg:py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(26,23,20,0.07) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="pointer-events-none absolute -right-[10%] top-0 h-[55%] w-[50%] opacity-60"
        aria-hidden
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 70% 20%, rgba(255,84,54,0.12) 0%, transparent 68%)',
        }}
      />

      <StudioCraftContainer className="relative">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
          <div className="lg:sticky lg:top-[var(--nav-h)] lg:col-span-1 lg:self-start">
            <Reveal>
              <SectionBadge number="4" label={compliance.badge} />
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--sc-ink)]">
                <span className="block">Compliance is not</span>
                <span className="block text-[var(--sc-coral)]">an add-on.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-[480px] text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg">
                {compliance.body}
              </p>
            </Reveal>
          </div>

          <div className="min-w-0 lg:col-span-1">
            <ComplianceBento />
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
