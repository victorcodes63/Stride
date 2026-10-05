import Image from 'next/image';
import Link from 'next/link';
import { AboutFinalCta } from '@/components/marketing/about/AboutFinalCta';
import { MarketingModuleBadge } from '@/components/marketing/MarketingModuleBadge';
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { PlatformArchitectureSection } from '@/components/marketing/platform/PlatformArchitectureSection';
import { PlatformModuleAccordion } from '@/components/marketing/platform/PlatformModuleAccordion';
import { PlatformProductBento } from '@/components/marketing/platform/PlatformProductBento';
import { PlatformSectionHead } from '@/components/marketing/platform/PlatformSectionHead';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import {
  HOW_IT_WORKS_STEPS,
  INDUSTRY_VERTICALS,
  MARKETING_CTAS,
  MARKETING_PLATFORM_MODULES_SCREENSHOT,
  MARKETING_ROUTES,
  PLATFORM_AUDIENCE,
  PLATFORM_FAQ,
  PLATFORM_MODULES,
  PLATFORM_PAGE,
  PLATFORM_WORKFLOWS,
} from '@/lib/marketing-config';

/** Facts only — derived from the module and pack registries so they stay true. */
const PROOF_POINTS: readonly { count: number; label: string }[] = [
  { count: PLATFORM_MODULES.length, label: 'product areas on one login' },
  { count: 2, label: 'included on every plan' },
  { count: INDUSTRY_VERTICALS.filter((v) => v.status === 'available').length, label: 'industry packs on the same core' },
  { count: 1, label: 'employee record behind every module' },
];

/* ---------------- 01 · Hero ---------------- */

function DotMatrix() {
  // 6 × 5 dots; a few pulse coral. Deterministic so server and client agree.
  const lit = new Set([3, 8, 14, 19, 22, 27]);
  return (
    <div className="grid w-fit grid-cols-6 gap-3" aria-hidden>
      {Array.from({ length: 30 }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${lit.has(i) ? 'bg-[var(--sc-coral)] [animation:platform-dot_2.8s_ease-in-out_infinite]' : 'bg-white/15'}`}
          style={lit.has(i) ? { animationDelay: `${(i % 5) * 0.45}s` } : undefined}
        />
      ))}
    </div>
  );
}

function PlatformHero() {
  const { hero } = PLATFORM_PAGE;
  const { src, width, height, alt } = MARKETING_PLATFORM_MODULES_SCREENSHOT;

  return (
    <section className="relative bg-white pb-24 pt-10 sm:pb-28 sm:pt-14 lg:pb-36">
      <StudioCraftContainer>
        {/* SEO: the page's single H1 carries the search phrase; the oversized title below is visual. */}
        <h1 className="mb-8 flex items-center gap-3 text-[14px] font-medium text-[var(--sc-ink-muted)] sm:text-[15px]">
          <span className="h-px w-8 bg-[var(--sc-coral)]" aria-hidden />
          The Stride platform: HR, Payroll, Finance &amp; industry modules
        </h1>

        <PlatformSectionHead
          as="p"
          index="01"
          label="The platform"
          title={
            <>
              One platform<span className="text-[var(--sc-coral)]">.</span>
            </>
          }
          statement={
            <>
              {hero.titleLines[0]} <span className="text-[var(--sc-coral)]">{hero.titleLines[1]}</span>
            </>
          }
          note={
            <>
              <p>{hero.description}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <MarketingPrimaryLink href={MARKETING_ROUTES.contact} label={MARKETING_CTAS.bookDemo} variant="coral" showArrow />
                <Link
                  href={MARKETING_ROUTES.pricing}
                  className="group inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-[var(--sc-ink)] transition-colors hover:text-[var(--sc-coral)]"
                >
                  View pricing
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            </>
          }
        />

        {/* Showcase panel: facts on the left, the product on the right. */}
        <Reveal delay={0.12}>
          <div className="sc-on-ink mt-14 grid overflow-hidden rounded-[28px] bg-[var(--sc-ink)] p-3 text-white shadow-[0_40px_90px_-40px_rgba(26,23,20,0.7)] sm:mt-20 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-white/55">Stride Core</p>
                <p className="text-[13px] font-semibold text-white">2/{PLATFORM_MODULES.length}</p>
              </div>
              <p className="mt-5 text-[26px] font-medium leading-[1.15] tracking-[-0.025em] text-white">
                HR &amp; Payroll and Finance on every plan. Everything else plugs in.
              </p>
              <div className="mt-8">
                <DotMatrix />
              </div>
              <dl className="mt-auto pt-10">
                {PROOF_POINTS.map((point) => (
                  <div key={point.label} className="flex items-baseline gap-4 border-t border-white/10 py-3.5">
                    <dt className="w-10 text-[24px] font-medium leading-none tracking-[-0.03em] text-white">
                      <CountUp value={point.count} duration={1.4} />
                    </dt>
                    <dd className="text-[13px] leading-snug text-white/55">{point.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative overflow-hidden rounded-[20px] bg-[#232020]">
              <div
                className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.3),transparent)]"
                aria-hidden
              />
              <div className="relative flex h-full items-center p-4 sm:p-8 lg:p-10">
                <div className="w-full overflow-hidden rounded-[14px] border border-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center gap-1.5 border-b border-white/10 bg-[#1d1a18] px-4 py-2.5" aria-hidden>
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="ml-3 rounded-md bg-white/[0.06] px-3 py-0.5 text-[11px] text-white/40">app.getstride.co.ke</span>
                  </div>
                  <Image src={src} alt={alt} width={width} height={height} priority className="block h-auto w-full" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </StudioCraftContainer>
      <style>{`@keyframes platform-dot{0%,100%{opacity:.25}50%{opacity:1}}@media (prefers-reduced-motion:reduce){[class*="platform-dot"]{animation:none!important;opacity:1}}`}</style>
    </section>
  );
}

/* ---------------- 02 · Modules ---------------- */

function PlatformModulesSection() {
  return (
    <section className="border-t border-[var(--sc-line)] bg-white py-24 sm:py-28 lg:py-36" aria-labelledby="platform-modules-heading">
      <StudioCraftContainer>
        <PlatformSectionHead
          id="platform-modules-heading"
          index="02"
          label="Modules"
          title="Modules"
          statement={
            <>
              Core first. <span className="text-[var(--sc-coral)]">Plug-ins when you need them.</span>
            </>
          }
          note="HR & Payroll and Finance come with every plan. Switch on the rest as you grow, on the same login, records and approvals."
        />
        <div className="mt-14 lg:mt-20">
          <PlatformModuleAccordion />
        </div>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- 03 · In the product ---------------- */

function PlatformProductSection() {
  return (
    <section className="bg-[var(--sc-paper-2)] py-24 sm:py-28 lg:py-36" aria-labelledby="platform-product-heading">
      <StudioCraftContainer>
        <PlatformSectionHead
          id="platform-product-heading"
          index="03"
          label="In the product"
          title="Day to day"
          statement={
            <>
              What your team sees <span className="text-[var(--sc-coral)]">every morning.</span>
            </>
          }
          note="An illustrative 120-person team across Kenya and Uganda. We show statuses and counts here, never your figures."
        />
        <div className="mt-14 lg:mt-20">
          <PlatformProductBento />
        </div>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- 04 · Connected workflows ---------------- */

function PlatformConnectedSection() {
  const { connected } = PLATFORM_PAGE;
  return (
    <section
      className="sc-on-ink relative overflow-hidden bg-[var(--sc-ink)] py-24 text-white sm:py-28 lg:py-36"
      aria-labelledby="platform-connected-heading"
    >
      <div
        className="pointer-events-none absolute right-[-10rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.16),transparent)]"
        aria-hidden
      />
      <StudioCraftContainer className="relative">
        <PlatformSectionHead
          tone="dark"
          id="platform-connected-heading"
          index="04"
          label={connected.badge}
          title="Connected"
          statement={
            <>
              Modules that actually <span className="text-[var(--sc-coral)]">talk to each other.</span>
            </>
          }
          note={connected.body}
        />

        <Stagger className="mt-14 lg:mt-20" delayChildren={0.1}>
          {PLATFORM_WORKFLOWS.map((workflow, index) => {
            const steps = workflow.flow.split('→').map((step) => step.trim());
            return (
              <StaggerItem
                key={workflow.title}
                as="article"
                className="grid gap-6 border-t border-white/10 py-9 last:border-b lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,300px)] lg:items-center lg:gap-12"
              >
                <div>
                  <p className="text-[13px] text-white/40">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="mt-1 text-[24px] font-medium tracking-[-0.025em] text-white">{workflow.title}</h3>
                  <MarketingModuleBadge readiness={workflow.status} variant="dark" className="mt-3" />
                </div>

                <ol className="flex flex-wrap items-center gap-y-3">
                  {steps.map((step, stepIndex) => (
                    <li key={step} className="flex items-center">
                      <span
                        className={`inline-block rounded-full px-3.5 py-2 text-[13px] font-medium first-letter:uppercase ${
                          stepIndex === steps.length - 1
                            ? 'bg-[var(--sc-coral)] text-white'
                            : 'border border-white/15 bg-white/[0.05] text-white/85'
                        }`}
                      >
                        {step}
                      </span>
                      {stepIndex < steps.length - 1 ? (
                        <span className="mx-1.5 h-px w-5 bg-gradient-to-r from-white/30 to-[var(--sc-coral)]/70" aria-hidden />
                      ) : null}
                    </li>
                  ))}
                </ol>

                <p className="text-[14px] leading-[1.65] text-white/55">{workflow.body}</p>
              </StaggerItem>
            );
          })}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- 06 · Who it's for ---------------- */

function PlatformAudienceSection() {
  const { audience } = PLATFORM_PAGE;
  return (
    <section className="border-t border-[var(--sc-line)] bg-white py-24 sm:py-28 lg:py-36" aria-labelledby="platform-audience-heading">
      <StudioCraftContainer>
        <PlatformSectionHead
          id="platform-audience-heading"
          index="06"
          label={audience.badge}
          title="Who it's for"
          statement={
            <>
              Teams that have <span className="text-[var(--sc-coral)]">outgrown spreadsheets.</span>
            </>
          }
          note={audience.body}
        />

        <Stagger className="mt-14 lg:mt-20" delayChildren={0.08}>
          {PLATFORM_AUDIENCE.map((segment, index) => (
            <StaggerItem
              key={segment.title}
              as="article"
              className="group grid gap-3 border-t border-[var(--sc-line)] py-9 last:border-b sm:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,420px)] lg:items-baseline lg:gap-12"
            >
              <span className="text-[15px] font-medium text-[var(--sc-coral)]">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="text-[clamp(1.75rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.035em] text-[var(--sc-ink)] transition-colors duration-300 group-hover:text-[var(--sc-coral)]">
                {segment.title}
              </h3>
              <p className="text-[15px] leading-[1.7] text-[var(--sc-ink-muted)] sm:col-start-2 lg:col-start-auto">{segment.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}

/* ---------------- 07 · Getting started ---------------- */

function PlatformRolloutSection() {
  return (
    <section className="bg-[var(--sc-paper-2)] py-24 sm:py-28 lg:py-36" aria-labelledby="platform-rollout-heading">
      <StudioCraftContainer>
        <PlatformSectionHead
          id="platform-rollout-heading"
          index="07"
          label="Getting started"
          title="Go live"
          statement={
            <>
              Live in <span className="text-[var(--sc-coral)]">days, not months.</span>
            </>
          }
          note="We migrate your data and run your first payroll alongside your current process, so you can check every figure before you switch."
        />

        <Stagger className="mt-14 grid gap-3 lg:mt-20 lg:grid-cols-3" delayChildren={0.1}>
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <StaggerItem
              key={step.step}
              as="article"
              className={`flex min-h-[340px] flex-col rounded-[22px] p-7 sm:p-8 ${
                index === 2
                  ? 'sc-on-ink bg-[var(--sc-coral)] text-white shadow-[0_30px_70px_-36px_rgba(230,62,34,0.7)]'
                  : 'border border-[var(--sc-line)] bg-white shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-34px_rgba(26,23,20,0.22)]'
              }`}
            >
              <span
                className={`text-[88px] font-light leading-[0.8] tracking-[-0.06em] ${
                  index === 2 ? 'text-white' : 'text-[rgba(26,23,20,0.14)]'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3
                className={`mt-14 text-[24px] font-medium leading-tight tracking-[-0.025em] ${
                  index === 2 ? 'text-white' : 'text-[var(--sc-ink)]'
                }`}
              >
                {step.title}
              </h3>
              <p className={`mt-3 text-[15px] leading-[1.7] ${index === 2 ? 'text-white/85' : 'text-[var(--sc-ink-muted)]'}`}>
                {step.body}
              </p>
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
      <PlatformModulesSection />
      <PlatformProductSection />
      <PlatformConnectedSection />
      <PlatformArchitectureSection />
      <PlatformAudienceSection />
      <PlatformRolloutSection />
      <MarketingFaq items={PLATFORM_FAQ} />
      <AboutFinalCta />
    </>
  );
}
