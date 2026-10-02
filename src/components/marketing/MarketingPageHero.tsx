import type { ReactNode } from 'react';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';

const HERO_SHELL =
  'marketing-page-hero relative border-b border-[var(--sc-line)]/70 bg-[var(--sc-paper)] pt-14 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-24';

type MarketingPageHeroProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  decorations?: ReactNode;
};

/** Standard inner-page hero shell — vertical rhythm only; horizontal padding lives on StudioCraftContainer. */
export function MarketingPageHero({
  children,
  className = '',
  containerClassName = '',
  decorations,
}: MarketingPageHeroProps) {
  return (
    <header className={`${HERO_SHELL} ${className}`.trim()}>
      {decorations}
      <StudioCraftContainer className={containerClassName}>{children}</StudioCraftContainer>
    </header>
  );
}

export function MarketingPageHeroEyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--sc-coral)]/15 bg-[var(--sc-coral)]/[0.06] px-3 py-1 text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--sc-coral)] ${className}`.trim()}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
      {children}
    </p>
  );
}

export function MarketingPageHeroTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={`text-[clamp(2.125rem,6.5vw,4rem)] font-medium leading-[1.05] tracking-[-0.035em] [text-wrap:balance] text-[var(--sc-ink)] ${className}`.trim()}
    >
      {children}
    </h1>
  );
}

export function MarketingPageHeroDescription({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`max-w-[600px] text-[17px] leading-[1.65] text-[var(--sc-ink-muted)] sm:text-[19px] ${className}`.trim()}
    >
      {children}
    </p>
  );
}
