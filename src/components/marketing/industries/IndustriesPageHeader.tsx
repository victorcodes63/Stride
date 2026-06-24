import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { INDUSTRIES_HERO } from './industries-content';

/** Compact page header — spacing mirrors PlatformHero on /platform. */
export function IndustriesPageHeader() {
  return (
    <header className="bg-[var(--sc-paper)] px-5 pb-8 pt-4 sm:px-8 sm:pb-10 sm:pt-6 lg:px-12">
      <StudioCraftContainer>
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--sc-coral)]/15 bg-[var(--sc-coral)]/[0.06] px-3 py-1 text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--sc-coral)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
          {INDUSTRIES_HERO.eyebrow}
        </p>
        <h1 className="max-w-2xl text-[clamp(1.875rem,7vw,3.25rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)]">
          {INDUSTRIES_HERO.title}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--sc-ink-muted)] sm:mt-5 sm:text-lg">
          {INDUSTRIES_HERO.subhead}
        </p>
      </StudioCraftContainer>
    </header>
  );
}
