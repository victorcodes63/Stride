'use client';

import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import type { IndustryDeepDive } from './industries-content';
import { IndustryMediaMotif } from './IndustryMediaMotif';

type IndustryDeepDiveSectionProps = {
  industry: IndustryDeepDive;
  index: number;
};

export function IndustryDeepDiveSection({ industry, index }: IndustryDeepDiveSectionProps) {
  const mediaRight = index % 2 === 0;
  const altBg = index % 2 === 1;

  return (
    <section
      id={industry.id}
      className={`scroll-anchor scroll-mt-28 py-16 sm:py-20 lg:py-28 ${
        altBg ? 'bg-[var(--sc-paper-2)]' : 'bg-[var(--sc-paper)]'
      }`}
      aria-labelledby={`industry-${industry.id}-title`}
    >
      <StudioCraftContainer>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Media first in DOM — stacks above text on mobile */}
          <Reveal
            delay={0.08}
            className={mediaRight ? 'order-1 lg:order-2' : 'order-1 lg:order-1'}
          >
            <IndustryMediaMotif mediaKey={industry.mediaKey} />
          </Reveal>

          <div className={mediaRight ? 'order-2 lg:order-1' : 'order-2 lg:order-2'}>
            <Reveal>
              <p className="font-mono text-[11px] text-[var(--sc-ink-subtle,#8A8076)]">
                <span
                  className={
                    industry.status === 'available'
                      ? 'text-[var(--sc-coral)]'
                      : 'text-[var(--sc-ink-subtle,#8A8076)]'
                  }
                >
                  {industry.status === 'available' ? 'Live' : 'Roadmap'}
                </span>
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <h2
                id={`industry-${industry.id}-title`}
                className="mt-3 font-heading text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold tracking-[-0.03em] text-[var(--sc-ink)]"
              >
                {industry.name}
              </h2>
              <p className="mt-2 text-lg font-medium text-[var(--sc-coral)]">
                {industry.positioning}
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-6 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sc-ink-subtle,#8A8076)]">
                    The pain
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-[var(--sc-ink-muted)]">
                    {industry.pain}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sc-ink-subtle,#8A8076)]">
                    What Stride runs
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-[var(--sc-ink-muted)]">
                    {industry.strideRuns}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sc-ink-subtle,#8A8076)]">
                    The opportunity
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-[var(--sc-ink-muted)]">
                    {industry.opportunity}
                  </p>
                </div>
              </div>
            </Reveal>

            <Stagger className="mt-8 grid gap-4 sm:grid-cols-3" delayChildren={0.12}>
              {industry.stats.map((stat) => (
                <StaggerItem
                  key={stat.label}
                  className="rounded-xl border border-[var(--sc-line)] bg-white p-4"
                >
                  <p className="font-mono text-2xl font-semibold tracking-tight text-[var(--sc-ink)]">
                    <CountUp
                      value={stat.value}
                      suffix={stat.suffix}
                      prefix={stat.prefix}
                    />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-[var(--sc-ink-subtle,#8A8076)]">
                    {stat.label}
                  </p>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal delay={0.16} className="mt-8">
              <MarketingPrimaryLink
                href={
                  industry.status === 'available'
                    ? industry.href
                    : `/contact?sector=${industry.id}`
                }
                label={industry.ctaLabel}
                variant="coral"
              />
            </Reveal>
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
