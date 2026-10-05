import Link from 'next/link';
import {
  MARKETING_CTAS,
  MARKETING_DASHBOARD_HERO,
  MARKETING_HERO,
  MARKETING_ROUTES,
} from '@/lib/marketing-config';
import { PRICING_INTENTS, contactHref, formatKes, getPricingPlan } from '@/lib/pricing';
import { CountUp } from '@/components/marketing/motion';
import { HomeHeroShowcase } from '@/components/marketing/home/HomeHeroShowcase';
import { StrideHeroDashboardMockup } from '@/components/marketing/v3/StrideHeroDashboardMockup';
import {
  MarketingPrimaryLink,
  StudioCraftContainer,
} from '@/components/marketing/v3/studio-craft-shared';
import '@/components/marketing/v3/studio-craft-hero.css';

const essentialsRate = getPricingPlan('essentials').rateKesPerEmployee ?? 0;

/** Facts only — every line here must stay true of the product. */
const PROOF_POINTS: readonly { value: string; count?: { to: number; prefix?: string }; label: string }[] = [
  {
    value: formatKes(essentialsRate),
    count: { to: essentialsRate, prefix: 'KES ' },
    label: 'per employee a month, no minimums',
  },
  { value: '4', count: { to: 4 }, label: 'statutory deductions on every run: PAYE, NSSF, SHIF, Housing Levy' },
  { value: 'M-Pesa', label: 'bulk salary payouts, reconciled to payroll' },
  { value: '2', count: { to: 2 }, label: 'countries: Kenya and Uganda entities, one account' },
];

function HeroTitle() {
  const [lead, accentLine] = MARKETING_HERO.titleLines;
  const accent = MARKETING_HERO.titleAccent;
  const before = accentLine.endsWith(accent) ? accentLine.slice(0, -accent.length) : accentLine;

  return (
    <p className="sc-animate-fade-up text-[clamp(2.75rem,7.4vw,6.25rem)] font-medium leading-[0.98] [text-wrap:balance] tracking-[-0.025em] text-[#FFFFFF]">
      <span className="block">{lead}</span>
      <span className="block">
        {before}
        <span className="text-[var(--sc-coral)]">{accent}</span>
      </span>
    </p>
  );
}

export function HomeHero() {
  const { src, width, height, alt } = MARKETING_DASHBOARD_HERO;

  return (
    <section className="relative isolate overflow-hidden bg-[var(--sc-ink)] pt-[var(--nav-h)] text-white">
      {/* Atmosphere: a top light and a faint grid that fades out. */}
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
          {/* SEO: the page's single H1 carries the search phrase; the big line below is visual. */}
          <h1 className="sc-animate-fade-up mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-2 pl-3.5 pr-4 text-[13px] font-medium text-white/80 backdrop-blur sm:text-[14px]">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--sc-coral)] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--sc-coral)]" />
            </span>
            Payroll, HR &amp; Finance software for businesses in Kenya
          </h1>

          <HeroTitle />

          <p
            className="sc-animate-fade-up mt-8 max-w-[620px] text-[17px] leading-[1.7] text-white/65 sm:text-[19px]"
            style={{ animationDelay: '120ms' }}
          >
            {MARKETING_HERO.sub}
          </p>

          <div
            className="sc-animate-fade-up mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-6"
            style={{ animationDelay: '220ms' }}
          >
            <MarketingPrimaryLink
              href={MARKETING_ROUTES.contact}
              label={MARKETING_CTAS.bookDemo}
              variant="coral"
              showArrow
            />
            <Link
              href={contactHref(PRICING_INTENTS.parallelRun)}
              className="group inline-flex min-h-11 items-center gap-2 px-2 text-[15px] font-semibold text-white transition-colors hover:text-[var(--sc-coral)]"
            >
              Get a free payroll run
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>

          <p
            className="sc-animate-fade-up mt-7 text-[13px] font-medium uppercase tracking-[0.14em] text-white/40"
            style={{ animationDelay: '300ms' }}
          >
            Compliant · M-Pesa native · One platform
          </p>
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
              key={point.value}
              className={`px-4 py-8 text-center sm:px-6 sm:py-10 ${index % 2 === 1 ? 'border-l border-white/10' : ''} ${
                index >= 2 ? 'border-t border-white/10 lg:border-t-0' : ''
              } ${index >= 1 ? 'lg:border-l' : ''}`}
            >
              <dt className="text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-none tracking-[-0.03em] text-white">
                {point.count ? (
                  <CountUp value={point.count.to} prefix={point.count.prefix} duration={1.6} />
                ) : (
                  point.value
                )}
              </dt>
              <dd className="mx-auto mt-3 max-w-[16rem] text-[14px] leading-relaxed text-white/50">
                {point.label}
              </dd>
            </div>
          ))}
        </dl>
      </StudioCraftContainer>
    </section>
  );
}
