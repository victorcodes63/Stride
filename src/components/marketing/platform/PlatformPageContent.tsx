import Link from 'next/link';
import { AboutFinalCta } from '@/components/marketing/about/AboutFinalCta';
import { HomeCapabilityTicker } from '@/components/marketing/home/HomeCapabilityTicker';
import { HomeComplianceProcess } from '@/components/marketing/home/HomeComplianceProcess';
import { HomeHeroShowcase } from '@/components/marketing/home/HomeHeroShowcase';
import { MarketingModuleBadge } from '@/components/marketing/MarketingModuleBadge';
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { PlatformArchitectureSection } from '@/components/marketing/platform/PlatformArchitectureSection';
import { PlatformAudienceCards } from '@/components/marketing/platform/PlatformAudienceCards';
import { PlatformModuleExplorer } from '@/components/marketing/platform/PlatformModuleExplorer';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { StrideHeroDashboardMockup } from '@/components/marketing/v3/StrideHeroDashboardMockup';
import {
  MarketingPrimaryLink,
  SectionBadge,
  StudioCraftContainer,
} from '@/components/marketing/v3/studio-craft-shared';
import {
  HOW_IT_WORKS_STEPS,
  INDUSTRY_VERTICALS,
  MARKETING_CTAS,
  MARKETING_PLATFORM_MODULES_SCREENSHOT,
  MARKETING_ROUTES,
  PLATFORM_FAQ,
  PLATFORM_MODULES,
  PLATFORM_PAGE,
  PLATFORM_WORKFLOWS,
} from '@/lib/marketing-config';
import '@/components/marketing/v3/studio-craft-hero.css';

/** Facts only — derived from the module and pack registries so they stay true. */
const PROOF_POINTS: readonly { count: number; label: string }[] = [
  { count: PLATFORM_MODULES.length, label: 'product areas on one login' },
  { count: 2, label: 'included on every plan: HR & Payroll and Finance' },
  { count: INDUSTRY_VERTICALS.filter((v) => v.status === 'available').length, label: 'industry packs on the same core' },
  { count: 1, label: 'employee record shared by every module' },
];

/* ---------------- Hero ---------------- */

function PlatformHero() {
  const { hero } = PLATFORM_PAGE;
  const { src, width, height, alt } = MARKETING_PLATFORM_MODULES_SCREENSHOT;

  return (
    <section className="relative isolate overflow-hidden bg-[var(--sc-ink)] pt-[var(--nav-h)] text-white">
      {/* Same atmosphere as the homepage hero: coral top glow and a faint grid. */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-18rem] -z-10 h-[46rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.22),rgba(255,84,54,0.06)_55%,transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 60% 45% at 50% 22%, black 0%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 45% at 50% 22%, black 0%, transparent 80%)',
        }}
      />

      <StudioCraftContainer>
        <div className="mx-auto flex max-w-[980px] flex-col items-center pt-14 text-center sm:pt-20 lg:pt-24">
          {/* SEO: the page's single H1 carries the search phrase. */}
          <h1 className="sc-animate-fade-up mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-2 pl-3.5 pr-4 text-[13px] font-medium text-white/80 backdrop-blur sm:text-[14px]">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--sc-coral)] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--sc-coral)]" />
            </span>
            The Stride platform: HR, Payroll, Finance &amp; industry modules
          </h1>

          <p className="sc-animate-fade-up text-[clamp(2.5rem,6.4vw,5.5rem)] font-medium leading-[1] tracking-[-0.025em] text-white [text-wrap:balance]">
            <span className="block">{hero.titleLines[0]}</span>
            <span className="block text-[var(--sc-coral)]">{hero.titleLines[1]}</span>
          </p>

          <p
            className="sc-animate-fade-up mt-8 max-w-[640px] text-[17px] leading-[1.7] text-white/65 sm:text-[19px]"
            style={{ animationDelay: '120ms' }}
          >
            {hero.description}
          </p>

          <div
            className="sc-animate-fade-up mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-6"
            style={{ animationDelay: '220ms' }}
          >
            <MarketingPrimaryLink href={MARKETING_ROUTES.contact} label={MARKETING_CTAS.bookDemo} variant="coral" showArrow />
            <Link
              href={MARKETING_ROUTES.pricing}
              className="group inline-flex min-h-11 items-center gap-2 px-2 text-[15px] font-semibold text-white transition-colors hover:text-[var(--sc-coral)]"
            >
              View pricing
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-16 sm:mt-20 lg:mt-24">
          <div className="md:hidden">
            <StrideHeroDashboardMockup />
          </div>
          <div className="hidden md:block">
            <HomeHeroShowcase screenshot={{ src, alt, width, height }} />
          </div>
        </div>

        <dl className="mt-20 grid grid-cols-2 border-t border-white/10 lg:mt-24 lg:grid-cols-4">
          {PROOF_POINTS.map((point, index) => (
            <div
              key={point.label}
              className={`py-8 pr-6 sm:py-10 ${index % 2 === 1 ? 'border-l border-white/10 pl-6' : ''} ${
                index >= 2 ? 'border-t border-white/10 lg:border-t-0' : ''
              } ${index === 2 ? 'lg:border-l lg:pl-6' : ''}`}
            >
              <dt className="text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-none tracking-[-0.03em] text-white">
                <CountUp value={point.count} duration={1.4} />
              </dt>
              <dd className="mt-3 max-w-[16rem] text-[14px] leading-relaxed text-white/50">{point.label}</dd>
            </div>
          ))}
        </dl>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- Who it's for ---------------- */

function PlatformAudienceSection() {
  const { audience } = PLATFORM_PAGE;
  return (
    <section className="bg-white py-24 sm:py-28 lg:py-36" aria-labelledby="platform-audience-heading">
      <StudioCraftContainer>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
          <Reveal>
            <SectionBadge label={audience.badge} />
            <h2
              id="platform-audience-heading"
              className="max-w-[760px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)] [text-wrap:balance]"
            >
              Built for teams that have <span className="text-[var(--sc-coral)]">outgrown spreadsheets.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[16px] leading-[1.7] text-[var(--sc-ink-muted)]">{audience.body}</p>
          </Reveal>
        </div>
        <PlatformAudienceCards />
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- Connected workflows (dark band) ---------------- */

function PlatformConnectedSection() {
  const { connected } = PLATFORM_PAGE;
  return (
    <section className="sc-on-ink relative overflow-hidden bg-[var(--sc-ink)] py-24 text-white sm:py-28 lg:py-36" aria-labelledby="platform-connected-heading">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.16),transparent)]"
        aria-hidden
      />
      <StudioCraftContainer className="relative">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
          <Reveal>
            <SectionBadge label={connected.badge} />
            <h2
              id="platform-connected-heading"
              className="max-w-[760px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-white [text-wrap:balance]"
            >
              Modules that actually <span className="text-[var(--sc-coral)]">talk to each other.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[16px] leading-[1.7] text-white/60">{connected.body}</p>
          </Reveal>
        </div>

        <Stagger className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-3" delayChildren={0.1}>
          {PLATFORM_WORKFLOWS.map((workflow) => {
            const steps = workflow.flow.split('→').map((step) => step.trim());
            return (
              <StaggerItem
                key={workflow.title}
                as="article"
                className="flex flex-col rounded-[20px] border border-white/10 bg-white/[0.04] p-6 sm:p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[22px] font-medium tracking-[-0.02em] text-white">{workflow.title}</h3>
                  <MarketingModuleBadge readiness={workflow.status} variant="dark" className="shrink-0" />
                </div>
                <ol className="mt-6 space-y-2">
                  {steps.map((step, index) => (
                    <li key={step} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sc-coral)]/15 text-[11px] font-semibold text-[var(--sc-coral)]">
                        {index + 1}
                      </span>
                      <span className="text-[14px] text-white/85">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 border-t border-white/10 pt-5 text-[14px] leading-[1.65] text-white/55">{workflow.body}</p>
              </StaggerItem>
            );
          })}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- Rollout ---------------- */

function PlatformRolloutSection() {
  return (
    <section className="bg-white py-24 sm:py-28 lg:py-36" aria-labelledby="platform-rollout-heading">
      <StudioCraftContainer>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
          <Reveal>
            <SectionBadge label="Getting started" />
            <h2
              id="platform-rollout-heading"
              className="max-w-[760px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)]"
            >
              Live in <span className="text-[var(--sc-coral)]">days, not months.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[16px] leading-[1.7] text-[var(--sc-ink-muted)]">
              We migrate your data and run your first payroll alongside your current process, so you can check
              every figure before you switch.
            </p>
          </Reveal>
        </div>

        <Stagger className="relative mt-14 grid gap-4 lg:mt-20 lg:grid-cols-3" delayChildren={0.1}>
          {/* Connector line behind the step numbers (desktop). */}
          <span
            className="pointer-events-none absolute left-[16%] right-[16%] top-[3.25rem] hidden h-px bg-gradient-to-r from-[var(--sc-coral)] via-[var(--sc-coral)]/40 to-[var(--sc-line)] lg:block"
            aria-hidden
          />
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <StaggerItem
              key={step.step}
              as="article"
              className="relative rounded-[20px] border border-[var(--sc-line)] bg-white p-7 shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-32px_rgba(26,23,20,0.22)]"
            >
              <span
                className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-[14px] text-[18px] font-semibold ${
                  index === 0 ? 'bg-[var(--sc-coral)] text-white' : 'bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-6 text-[22px] font-medium leading-tight tracking-[-0.02em] text-[var(--sc-ink)]">
                {step.title}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.7] text-[var(--sc-ink-muted)]">{step.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- Page ---------------- */

export function PlatformPageContent() {
  return (
    <>
      <PlatformHero />
      <HomeCapabilityTicker />
      <PlatformAudienceSection />
      <PlatformModuleExplorer />
      <PlatformConnectedSection />
      <PlatformArchitectureSection />
      <HomeComplianceProcess />
      <PlatformRolloutSection />
      <MarketingFaq items={PLATFORM_FAQ} />
      <AboutFinalCta />
    </>
  );
}
