'use client';

import type { ReactNode } from 'react';
import { Reveal } from '@/components/marketing/motion';
import { EditorialTextLink } from '@/components/marketing/editorial/EditorialParts';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';

type CtaLink = { href: string; label: string };

type MarketingCtaBandProps = {
  title: ReactNode;
  description?: string;
  primary: CtaLink;
  secondary?: CtaLink;
  /** Kept for compatibility; every closing band now uses the homepage's ink treatment. */
  variant?: 'ink' | 'coral';
  className?: string;
  /** Small coral label above the title. */
  eyebrow?: string;
};

/** Closing call to action — the same ink band and glow as the homepage's final CTA. */
export function MarketingCtaBand({
  title,
  description,
  primary,
  secondary,
  className = '',
  eyebrow = 'Get started',
}: MarketingCtaBandProps) {
  return (
    <section
      className={`pub-on-ink sc-on-ink relative overflow-hidden bg-[var(--sc-ink)] py-20 text-center text-white sm:py-24 lg:py-32 ${className}`.trim()}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(--sc-coral) 22%, transparent) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <StudioCraftContainer className="relative z-[1]">
        <Reveal>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--sc-coral)]/[0.12] px-3 py-1 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--sc-coral)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
            {eyebrow}
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mx-auto max-w-[900px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] !text-white [text-wrap:balance]">
            {title}
          </h2>
        </Reveal>
        {description ? (
          <Reveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.7] text-white/65 sm:text-[17px]">{description}</p>
          </Reveal>
        ) : null}
        <Reveal delay={0.14}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <MarketingPrimaryLink href={primary.href} label={primary.label} variant="coral" showArrow />
            {secondary ? <EditorialTextLink href={secondary.href} label={secondary.label} tone="dark" /> : null}
          </div>
        </Reveal>
      </StudioCraftContainer>
    </section>
  );
}
