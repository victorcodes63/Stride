import type { ReactNode } from 'react';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';

const HERO_SHELL =
  'marketing-page-hero relative bg-[var(--sc-paper)] pt-6 pb-10 sm:pt-8 sm:pb-12 lg:pt-10 lg:pb-16';

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
      className={`text-[clamp(1.875rem,7vw,3.75rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)] ${className}`.trim()}
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
      className={`max-w-[540px] text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg ${className}`.trim()}
    >
      {children}
    </p>
  );
}
