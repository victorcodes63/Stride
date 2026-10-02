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
  { value: 'KE + UG', label: 'entities run from one account' },
];

function HeroTitle() {
  const [lead, accentLine] = MARKETING_HERO.titleLines;
  const accent = MARKETING_HERO.titleAccent;
  const before = accentLine.endsWith(accent) ? accentLine.slice(0, -accent.length) : accentLine;

  return (
    <h1 className="sc-animate-fade-up text-[clamp(2.5rem,4.9vw,4.25rem)] font-medium leading-[1.03] [text-wrap:balance] tracking-[-0.025em] text-[#FFFFFF]">
      <span className="block">{lead}</span>
      <span className="block">
        {before}
        <span className="text-[var(--sc-coral)]">{accent}</span>
      </span>
    </h1>
  );
}

export function HomeHero() {
  const { src, width, height, alt } = MARKETING_DASHBOARD_HERO;

  return (
    <section className="relative isolate overflow-hidden bg-[var(--sc-ink)] pt-[var(--nav-h)] text-[#FFFFFF]">
      {/* Quiet depth: one coral glow and a fine grid, nothing animated. */}
      <div
        className="pointer-events-none absolute -right-40 top-10 -z-10 h-[620px] w-[620px] rounded-full bg-[var(--sc-coral)]/20 blur-[140px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255,0.6) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 70% 30%, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 70% 30%, black 0%, transparent 75%)',
        }}
      />

      <StudioCraftContainer>
        <div className="grid items-center gap-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-16 lg:pb-24 lg:pt-20">
          <div className="min-w-0">
            <p className="sc-animate-fade-up mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-2 pr-4 text-[13px] font-medium text-[#FFFFFF]/80">
              <span className="rounded-full bg-[var(--sc-coral)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
                Kenya
              </span>
              Built in Nairobi for East African business
            </p>

            <HeroTitle />

            <p
              className="sc-animate-fade-up mt-7 max-w-[520px] text-[17px] leading-[1.7] text-[#FFFFFF]/70 sm:text-[19px]"
              style={{ animationDelay: '120ms' }}
            >
              {MARKETING_HERO.sub}
            </p>

            <p
              className="sc-animate-fade-up mt-6 text-[15px] font-medium tracking-[-0.01em] text-[#FFFFFF]"
              style={{ animationDelay: '180ms' }}
            >
              Compliant. M-Pesa native. One platform.
            </p>

            <div
              className="sc-animate-fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
              style={{ animationDelay: '240ms' }}
            >
              <MarketingPrimaryLink
                href={MARKETING_ROUTES.contact}
                label={MARKETING_CTAS.bookDemo}
                variant="coral"
                showArrow
              />
              <Link
                href={contactHref(PRICING_INTENTS.parallelRun)}
                className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-2 text-[15px] font-semibold text-[#FFFFFF] transition-colors hover:text-[var(--sc-coral)] sm:justify-start"
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
          </div>

          <div className="sc-animate-hero-fade-in relative min-w-0" style={{ animationDelay: '200ms' }}>
            <div className="lg:hidden">
              <StrideHeroDashboardMockup />
            </div>
            <div className="relative hidden lg:block">
              <HomeHeroShowcase screenshot={{ src, alt, width, height }} />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t border-white/10 lg:grid-cols-4">
          {PROOF_POINTS.map((point, index) => (
            <div
              key={point.value}
              className={`py-8 pr-6 sm:py-10 ${index % 2 === 1 ? 'pl-6 border-l border-white/10' : ''} ${
                index >= 2 ? 'border-t border-white/10 lg:border-t-0' : ''
              } ${index === 2 ? 'lg:border-l lg:pl-6' : ''}`}
            >
              <dt className="text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-none tracking-[-0.02em] text-[#FFFFFF]">
                {point.count ? (
                  <CountUp value={point.count.to} prefix={point.count.prefix} duration={1.6} />
                ) : (
                  point.value
                )}
              </dt>
              <dd className="mt-3 max-w-[16rem] text-[14px] leading-relaxed text-[#FFFFFF]/55">
                {point.label}
              </dd>
            </div>
          ))}
        </dl>
      </StudioCraftContainer>
    </section>
  );
}
