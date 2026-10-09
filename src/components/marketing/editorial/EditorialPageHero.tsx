import type { ReactNode } from 'react';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/motion';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { breadcrumbJsonLd, type Breadcrumb } from '@/lib/marketing-schema';

type EditorialPageHeroProps = {
  /** Short label in the pill above the title (e.g. "Pricing"). */
  badge: string;
  /** The page H1. Wrap the second half in a coral span for the house style. */
  title: ReactNode;
  description?: ReactNode;
  /** CTA row shown to the right of the description on desktop. */
  actions?: ReactNode;
  /** Optional visual under the hero copy, e.g. an EditorialShowcasePanel. */
  children?: ReactNode;
  /** Emits BreadcrumbList JSON-LD (no visual change). */
  breadcrumb?: readonly Breadcrumb[];
  /** Hero title size: "display" matches the homepage headline; "page" is one step down for long titles. */
  size?: 'display' | 'page';
};

/**
 * Light hero for inner marketing pages. Same type scale as the homepage hero
 * (13–14px pill, 2.75–6.25rem headline, 17–19px intro), laid out left-aligned like /platform.
 */
export function EditorialPageHero({
  badge,
  title,
  description,
  actions,
  children,
  breadcrumb,
  size = 'display',
}: EditorialPageHeroProps) {
  const titleSize =
    size === 'display'
      ? 'text-[clamp(2.75rem,7.4vw,6.25rem)] leading-[0.98]'
      : 'text-[clamp(2.5rem,5.6vw,4.75rem)] leading-[1.02]';

  return (
    <section className="relative bg-white pb-20 pt-14 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
      {breadcrumb && breadcrumb.length > 0 ? <JsonLd data={breadcrumbJsonLd(breadcrumb)} /> : null}
      <StudioCraftContainer>
        <Reveal className="flex justify-center sm:justify-start">
          <p className="mb-8 inline-flex items-center justify-center gap-2.5 rounded-full border border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-2 pl-3.5 pr-4 text-center text-[13px] font-medium text-[var(--sc-ink-muted)] sm:text-[14px]">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--sc-coral)] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--sc-coral)]" />
            </span>
            {badge}
          </p>
        </Reveal>

        <Reveal delay={0.04}>
          <h1
            className={`max-w-[1100px] font-medium tracking-[-0.025em] text-[var(--sc-ink)] [text-wrap:balance] ${titleSize}`}
          >
            {title}
          </h1>
        </Reveal>

        {description || actions ? (
          <Reveal
            delay={0.1}
            className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16"
          >
            {description ? (
              <div className="max-w-[640px] text-[17px] leading-[1.7] text-[var(--sc-ink-muted)] sm:text-[19px]">
                {description}
              </div>
            ) : (
              <span />
            )}
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3">{actions}</div> : null}
          </Reveal>
        ) : null}

        {children ? <div className="mt-14 sm:mt-20">{children}</div> : null}
      </StudioCraftContainer>
    </section>
  );
}
