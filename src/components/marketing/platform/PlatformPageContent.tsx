import { ComplianceBento } from '@/components/marketing/home/ComplianceBento';
import Link from 'next/link';
import { PlatformModulesShowcase } from '@/components/marketing/platform/PlatformModulesShowcase';
import { PlatformArchitectureSection } from '@/components/marketing/platform/PlatformArchitectureSection';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { MarketingFinalCta } from '@/components/marketing/sections/MarketingFinalCta';
import { MarketingModuleBadge, MarketingReadinessLegend } from '@/components/marketing/MarketingModuleBadge';
import {
  MarketingOutlineLink,
  MarketingPrimaryLink,
  SectionBadge,
  StudioCraftContainer,
  TextRollLink,
} from '@/components/marketing/v3/studio-craft-shared';
import {
  HOW_IT_WORKS_STEPS,
  INDUSTRY_VERTICALS,
  MARKETING_CTAS,
  MARKETING_ROUTES,
  PLATFORM_AUDIENCE,
  PLATFORM_FAQ,
  PLATFORM_MODULES,
  PLATFORM_PAGE,
  PLATFORM_WORKFLOWS,
  MARKETING_HERO,
} from '@/lib/marketing-config';

function PlatformHero() {
  const { hero } = PLATFORM_PAGE;

  return (
    <header className="bg-[var(--sc-paper)] px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-12 lg:px-12 lg:pb-20 lg:pt-14">
      <StudioCraftContainer>
        <div className="grid min-w-0 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div className="min-w-0">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--sc-coral)]/15 bg-[var(--sc-coral)]/[0.06] px-3 py-1 text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--sc-coral)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--sc-coral)]" aria-hidden />
              {hero.eyebrow}
            </p>
            <h1 className="text-[clamp(1.875rem,7vw,3.75rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)]">
              <span className="block">{hero.titleLines[0]}</span>
              <span className="block text-[var(--sc-coral)]">{hero.titleLines[1]}</span>
            </h1>
            <p className="mt-6 max-w-[540px] text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg">
              {hero.description}
            </p>
            <ul className="mt-8 space-y-3">
              {hero.highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-[var(--sc-ink-muted)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <div className="marketing-cta-stack mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
              <TextRollLink href={MARKETING_ROUTES.contact} label={MARKETING_CTAS.bookDemo} variant="coral" />
              <MarketingOutlineLink href={MARKETING_ROUTES.pricing} label="View pricing" />
            </div>
            <p className="mt-6 text-[12px] leading-relaxed text-[var(--sc-ink-muted)] sm:mt-8 sm:text-[13px]">
              {MARKETING_HERO.trustBadge} · {MARKETING_HERO.trustTags}
            </p>
          </div>

          <div className="min-w-0">
            <PlatformModulesShowcase />
          </div>
        </div>
      </StudioCraftContainer>
    </header>
  );
}

function PlatformAudienceSection() {
  const { audience } = PLATFORM_PAGE;

  return (
    <section className="border-y border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-12 sm:py-20 lg:py-24">
      <StudioCraftContainer>
        <SectionBadge number="1" label={audience.badge} />
        <h2 className="max-w-[720px] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
          {audience.title}
        </h2>
        <p className="mt-4 max-w-[640px] text-base leading-relaxed text-[var(--sc-ink-muted)]">
          {audience.body}
        </p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PLATFORM_AUDIENCE.map((segment) => (
            <article
              key={segment.title}
              className="rounded-2xl border border-[var(--sc-line)] bg-[var(--sc-paper)] p-6"
            >
              <h3 className="text-lg font-medium tracking-tight text-[var(--sc-ink)]">{segment.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--sc-ink-muted)]">{segment.body}</p>
            </article>
          ))}
        </div>
      </StudioCraftContainer>
    </section>
  );
}

function PlatformModulesSection() {
  return (
    <section className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <SectionBadge number="2" label="Core modules" />
        <h2 className="max-w-[720px] text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
          Six modules. <span className="text-[var(--sc-coral)]">One platform.</span>
        </h2>
        <p className="mt-4 max-w-[640px] text-base leading-relaxed text-[var(--sc-ink-muted)]">
          Sign up with HR & Payroll and Finance — your two included modules — then switch on legal,
          admin or vertical packs when your operations need them. Procurement and Projects are on the
          roadmap; we badge every module honestly below.
        </p>
        <MarketingReadinessLegend className="mt-6" />

        <div className="mt-12 space-y-5">
          {PLATFORM_MODULES.map((mod) => (
            <article
              key={mod.num}
              className="grid gap-5 rounded-2xl border border-[var(--sc-line)] bg-[var(--sc-paper-2)] p-5 sm:gap-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-coral)]">
                    {mod.num} — {mod.name}
                  </p>
                  <MarketingModuleBadge readiness={mod.readiness} />
                </div>
                <h3 className="mt-2 text-xl font-medium tracking-tight text-[var(--sc-ink)] sm:text-2xl">
                  {mod.headline}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--sc-ink-muted)] sm:text-[15px]">
                  {mod.description}
                </p>
              </div>
              <ul className="grid min-w-0 gap-2.5 sm:grid-cols-1">
                {mod.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 rounded-xl border border-[var(--sc-line)] bg-[var(--sc-paper)] px-4 py-3 text-sm leading-snug text-[var(--sc-ink-muted)]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </StudioCraftContainer>
    </section>
  );
}

function PlatformConnectedSection() {
  const { connected } = PLATFORM_PAGE;

  return (
    <section className="sc-on-ink bg-[var(--sc-ink)] py-16 text-[var(--sc-on-ink-fg-muted)] sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <SectionBadge number="3" label={connected.badge} />
        <h2 className="max-w-[720px] text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-on-ink-fg)]">
          <span className="block text-[var(--sc-on-ink-fg)]">Modules that actually</span>
          <span className="block text-[var(--sc-coral)]">talk to each other.</span>
        </h2>
        <p className="mt-4 max-w-[640px] text-base leading-relaxed text-[var(--sc-on-ink-fg-muted)]">
          {connected.body}
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLATFORM_WORKFLOWS.map((workflow) => (
            <article
              key={workflow.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
            >
              <h3 className="text-lg font-medium text-[var(--sc-on-ink-fg)]">{workflow.title}</h3>
              <p className="mt-3 break-words font-mono text-[10px] uppercase leading-relaxed tracking-[0.06em] text-[var(--sc-coral)] sm:text-[11px] sm:tracking-[0.08em]">
                {workflow.flow}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--sc-on-ink-fg-subtle)]">{workflow.body}</p>
            </article>
          ))}
        </div>
      </StudioCraftContainer>
    </section>
  );
}

function PlatformComplianceSection() {
  const { compliance } = PLATFORM_PAGE;

  return (
    <section className="relative overflow-hidden bg-[var(--sc-paper-2)] py-16 sm:py-20 lg:py-24">
      <StudioCraftContainer>
        <SectionBadge number="4" label={compliance.badge} />
        <h2 className="max-w-[640px] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
          <span className="block">Compliance is not</span>
          <span className="block text-[var(--sc-coral)]">an add-on.</span>
        </h2>
        <p className="mt-4 max-w-[560px] text-base leading-relaxed text-[var(--sc-ink-muted)]">
          {compliance.body}
        </p>

        <ComplianceBento className="mt-10" />
      </StudioCraftContainer>
    </section>
  );
}

function PlatformVerticalsSection() {
  const available = INDUSTRY_VERTICALS.filter((v) => v.status === 'available');
  const comingSoon = INDUSTRY_VERTICALS.filter((v) => v.status === 'coming_soon').slice(0, 3);

  return (
    <section className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-24">
      <StudioCraftContainer>
        <SectionBadge number="5" label="Industry verticals" />
        <h2 className="max-w-[640px] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
          Same core. <span className="text-[var(--sc-coral)]">Sector depth when you need it.</span>
        </h2>
        <p className="mt-4 max-w-[620px] text-base leading-relaxed text-[var(--sc-ink-muted)]">
          Vertical packs add specialised workflows on top of the horizontal platform — not a separate
          product to integrate. Six sector packs are live today, from logistics and SACCOs to
          healthcare, energy, and construction.
        </p>

        <div
          className={`mt-10 grid gap-4 ${comingSoon.length > 0 ? 'lg:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}
        >
          {available.map((vertical) => (
            <Link
              key={vertical.id}
              href={vertical.href}
              className="group rounded-2xl border border-[var(--sc-coral)]/25 bg-[var(--sc-coral)]/[0.06] p-6 transition hover:border-[var(--sc-coral)]/40"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sc-coral)]">
                Live
              </p>
              <h3 className="mt-2 text-xl font-medium text-[var(--sc-ink)]">{vertical.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--sc-ink-muted)]">{vertical.description}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {vertical.features.slice(0, 4).map((feature) => (
                  <li
                    key={feature}
                    className="rounded-full border border-[var(--sc-line)] bg-[var(--sc-paper)] px-3 py-1 text-[12px] text-[var(--sc-ink-muted)]"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-flex text-sm font-semibold text-[var(--sc-coral)] group-hover:underline">
                Explore {vertical.name} →
              </span>
            </Link>
          ))}

          {comingSoon.length > 0 ? (
          <div className="rounded-2xl border border-[var(--sc-line)] bg-[var(--sc-paper-2)] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sc-ink-muted)]">
              On the roadmap
            </p>
            <ul className="mt-4 space-y-3">
              {comingSoon.map((vertical) => (
                <li key={vertical.id}>
                  <Link
                    href={vertical.href}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[var(--sc-line)] bg-[var(--sc-paper)] px-4 py-3 transition hover:border-[var(--sc-coral)]/30"
                  >
                    <div>
                      <p className="font-medium text-[var(--sc-ink)]">{vertical.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--sc-ink-muted)]">{vertical.features[0]}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[var(--sc-coral)]">Waitlist</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={MARKETING_ROUTES.industries}
              className="mt-5 inline-flex text-sm font-semibold text-[var(--sc-ink)] hover:text-[var(--sc-coral)]"
            >
              All industries →
            </Link>
          </div>
          ) : null}
        </div>
      </StudioCraftContainer>
    </section>
  );
}

function PlatformRolloutSection() {
  return (
    <section className="border-t border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-16 sm:py-20 lg:py-24">
      <StudioCraftContainer>
        <SectionBadge number="6" label="Getting started" />
        <h2 className="max-w-[640px] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
          Live in <span className="text-[var(--sc-coral)]">days, not months.</span>
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-3 lg:mt-14">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <div
              key={step.step}
              className="border-t-2 border-[var(--sc-coral)] pt-6"
              style={{
                borderColor: `color-mix(in srgb, var(--sc-coral, #ff5436) ${100 - i * 22}%, transparent)`,
              }}
            >
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-coral)]">
                {step.step}
              </p>
              <h3 className="mb-3 text-xl font-medium leading-tight tracking-[-0.02em] text-[var(--sc-ink)]">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--sc-ink-muted)]">{step.body}</p>
            </div>
          ))}
        </div>
      </StudioCraftContainer>
    </section>
  );
}

export function PlatformPageContent() {
  return (
    <>
      <PlatformHero />
      <PlatformAudienceSection />
      <PlatformModulesSection />
      <PlatformArchitectureSection />
      <PlatformConnectedSection />
      <PlatformComplianceSection />
      <PlatformVerticalsSection />
      <PlatformRolloutSection />
      <MarketingFaq items={PLATFORM_FAQ} />
      <MarketingFinalCta />
    </>
  );
}
