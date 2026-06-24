'use client';

import { WhyStrideStatutoryVisual } from '@/components/marketing/mockups/WhyStrideStatutoryVisual';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { MARKETING_CTAS, MARKETING_WHY_STRIDE } from '@/lib/marketing-config';
import {
  SectionBadge,
  StudioCraftContainer,
  TextRollLink,
} from '@/components/marketing/v3/studio-craft-shared';

export function StudioCraftWhySection() {
  return (
    <section className="relative border-t border-[var(--sc-line)]/50 bg-[var(--sc-paper-2)] pt-16 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-28">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="01" label={MARKETING_WHY_STRIDE.badge} />
        </Reveal>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <Reveal delay={0.06}>
              <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
                <span className="block">{MARKETING_WHY_STRIDE.titleLines[0]}</span>
                <span className="block text-[var(--sc-coral)]">{MARKETING_WHY_STRIDE.titleLines[1]}</span>
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="mt-6 max-w-[520px] space-y-5 text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg">
                {MARKETING_WHY_STRIDE.paragraphs.map((paragraph) => (
                  <p key={paragraph.lead.slice(0, 32)}>
                    {paragraph.lead}
                    {'emphasis' in paragraph && paragraph.emphasis ? (
                      <strong className="font-medium text-[var(--sc-ink)]">{paragraph.emphasis}</strong>
                    ) : null}
                  </p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.18}>
              <TextRollLink
                href="/platform"
                label={MARKETING_CTAS.explorePlatform}
                variant="coral"
                className="mt-8"
              />
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <WhyStrideStatutoryVisual className="w-full" />
          </Reveal>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
