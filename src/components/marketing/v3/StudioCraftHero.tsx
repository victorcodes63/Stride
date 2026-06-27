'use client';

import {
  MARKETING_BRAND,
  MARKETING_CTAS,
  MARKETING_HERO,
  MARKETING_ROUTES,
  getMarketingHeroEyebrowLines,
  getMarketingHeroTitleLead,
} from '@/lib/marketing-config';
import { HeroShaderBackground } from './HeroShaderBackground';
import { HeroDashboardShowcase } from './HeroDashboardShowcase';
import {
  MarketingPrimaryLink,
  MarketingSignInLink,
  StudioCraftContainer,
} from './studio-craft-shared';
import './studio-craft-hero.css';

function HeroSubcopy() {
  const sub = MARKETING_HERO.sub ?? '';
  const descriptionHighlight = MARKETING_HERO.descriptionHighlight ?? '';
  if (!sub) return null;
  if (!descriptionHighlight) return sub;
  const idx = sub.indexOf(descriptionHighlight);
  if (idx === -1) return sub;
  return (
    <>
      {sub.slice(0, idx)}
      <span className="text-[var(--sc-coral)]">{descriptionHighlight}</span>
      {sub.slice(idx + descriptionHighlight.length)}
    </>
  );
}

export function StudioCraftHero() {
  const eyebrowLines = getMarketingHeroEyebrowLines();
  const titleLead = getMarketingHeroTitleLead();

  return (
    <section className="sc-hero-section relative flex min-h-0 flex-col overflow-x-clip md:min-h-svh">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
        style={{
          background: `linear-gradient(165deg, ${MARKETING_BRAND.paper} 0%, ${MARKETING_BRAND.paper2} 48%, ${MARKETING_BRAND.paper} 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.34]"
        aria-hidden
        style={{
          background: `radial-gradient(ellipse 90% 70% at 50% 18%, ${MARKETING_BRAND.coral}28 0%, transparent 68%)`,
        }}
      />
      {/* Blend hero into the next section — keep light so the shader stays visible */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[28%] min-h-[8rem]"
        aria-hidden
        style={{
          background: `linear-gradient(to bottom, transparent 0%, ${MARKETING_BRAND.paper}55 50%, ${MARKETING_BRAND.paper2} 100%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <HeroShaderBackground />
      </div>

      <div className="relative z-20 flex flex-col md:min-h-0 md:flex-1">
        <div className="flex items-center justify-center pb-4 pt-[var(--nav-h)] sm:pb-6 md:flex-1 md:pb-8">
          <StudioCraftContainer className="flex flex-col items-center text-center">
            <p
              className="sc-animate-fade-up mb-4 flex flex-col items-center gap-0.5 rounded-full bg-[var(--sc-coral)]/[0.08] px-4 py-2 text-[11px] font-medium uppercase leading-snug tracking-[0.12em] text-[var(--sc-coral)] sm:mb-5 sm:text-[12px] sm:tracking-[0.14em]"
              style={{ animationDelay: '80ms' }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
                {eyebrowLines[0]}
              </span>
              {eyebrowLines[1] ? <span>{eyebrowLines[1]}</span> : null}
            </p>

            <h1 className="font-normal leading-[1.05] tracking-tight text-[var(--sc-ink)] text-[clamp(2rem,9vw,2.75rem)] min-[400px]:text-[44px] sm:text-6xl lg:text-7xl xl:text-[80px]">
              <span className="block sc-animate-fade-up" style={{ animationDelay: '160ms' }}>
                {titleLead}
              </span>
              <span className="block sc-animate-fade-up" style={{ animationDelay: '240ms' }}>
                business{' '}
                <span className="text-[var(--sc-coral)]">{MARKETING_HERO.titleAccent}</span>
              </span>
            </h1>

            <p
              className="sc-animate-fade-up mt-5 max-w-lg text-sm leading-relaxed text-[var(--sc-ink-muted)] sm:mt-6 sm:text-base lg:text-lg"
              style={{ animationDelay: '320ms' }}
            >
              <HeroSubcopy />
            </p>

            <div
              className="sc-hero-cta-row marketing-cta-stack sc-animate-fade-up mt-4 flex flex-wrap items-center justify-center gap-3 sm:mt-5"
              style={{ animationDelay: '400ms' }}
            >
              <MarketingPrimaryLink
                href={MARKETING_ROUTES.contact}
                label={MARKETING_CTAS.bookDemo}
                variant="coral"
              />
              <MarketingSignInLink />
            </div>
          </StudioCraftContainer>
        </div>

        <div className="sc-animate-hero-fade-in relative z-30 w-full shrink-0 pb-0 md:pb-2">
          <StudioCraftContainer className="px-3 sm:px-3">
            <div className="sc-hero-dashboard-stage relative">
              <div
                className="pointer-events-none absolute -inset-x-4 bottom-0 top-[30%] -z-10 rounded-[50%] bg-[#1A1714]/[0.06] blur-3xl sm:-inset-x-6"
                aria-hidden
              />
              <HeroDashboardShowcase />
            </div>
          </StudioCraftContainer>
        </div>
      </div>
    </section>
  );
}
