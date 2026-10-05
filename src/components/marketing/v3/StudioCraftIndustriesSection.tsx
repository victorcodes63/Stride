'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { CountUp, MOTION_EASE } from '@/components/marketing/motion';
import { ProductIndustryPreview } from '@/components/marketing/product/ProductIndustryPreview';
import {
  INDUSTRY_VERTICALS,
  MARKETING_INDUSTRIES_SECTION,
  MARKETING_ROUTES,
  type MarketingVerticalScreenshotId,
} from '@/lib/marketing-config';
import { getPricingPlan } from '@/lib/pricing';
import { SectionBadge, StudioCraftContainer } from './studio-craft-shared';

type Pack = (typeof INDUSTRY_VERTICALS)[number];

const byId = (id: MarketingVerticalScreenshotId) =>
  INDUSTRY_VERTICALS.find((vertical) => vertical.id === id) as Pack;

/** Bento placement: one featured pack, then five packs across two rows. */
const FEATURED = byId('logistics');
const ROW_TWO = [byId('saccos'), byId('healthcare'), byId('hr_consultancy')];
const ROW_THREE = [byId('energy'), byId('construction')];

const LIVE_COUNT = INDUSTRY_VERTICALS.filter((vertical) => vertical.status === 'available').length;
const essentialsRate = getPricingPlan('essentials').rateKesPerEmployee ?? 0;

const cardIn = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0 },
};

/* ---------- small pieces ---------- */

function DotGrid({ tone = 'ink' }: { tone?: 'ink' | 'white' }) {
  return (
    <span className="grid grid-cols-3 gap-[5px]" aria-hidden>
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className={`h-[3px] w-[3px] rounded-full ${tone === 'white' ? 'bg-white/70' : 'bg-[var(--sc-ink)]/35'}`}
        />
      ))}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/** Square coral button that widens to reveal a label on card hover. */
function GrowArrow({ label }: { label: string }) {
  return (
    <span className="inline-flex h-12 items-center justify-center gap-0 overflow-hidden rounded-[10px] bg-[var(--sc-coral)] px-[14px] text-white transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:gap-2.5 group-hover:px-5">
      <span className="max-w-0 whitespace-nowrap text-[14px] font-semibold opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:max-w-[12rem] group-hover:opacity-100">
        {label}
      </span>
      <ArrowIcon />
    </span>
  );
}

/** Twinkling dot field for the coral card. */
function DotField() {
  const reduceMotion = useReducedMotion();
  const cols = 6;
  const rows = 5;
  return (
    <div className="grid grid-cols-6 gap-y-7" aria-hidden>
      {Array.from({ length: cols * rows }).map((_, index) => {
        // Deterministic pseudo-random timing so server and client markup match.
        const delay = ((index * 37) % 23) / 10;
        const duration = 2.4 + ((index * 13) % 9) / 5;
        return (
          <span key={index} className="flex justify-center">
            <motion.span
              className="block h-[5px] w-[5px] rounded-full bg-white"
              initial={{ opacity: 0.35 }}
              animate={reduceMotion ? { opacity: 0.5 } : { opacity: [0.3, 1, 0.3], scale: [1, 1.35, 1] }}
              transition={reduceMotion ? undefined : { duration, delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          </span>
        );
      })}
    </div>
  );
}

/* ---------- cards ---------- */

function PackCard({
  pack,
  className = '',
  visualClassName = '',
  featured = false,
}: {
  pack: Pack;
  className?: string;
  visualClassName?: string;
  featured?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const visualY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [40, -40]);

  return (
    <motion.div variants={cardIn} transition={{ duration: 0.8, ease: MOTION_EASE }} className={className}>
      <div
        ref={ref}
        className="group relative flex h-full min-h-[380px] flex-col overflow-hidden rounded-[18px] bg-[var(--sc-paper-2)] p-7 ring-1 ring-inset ring-[var(--sc-line)] transition-shadow duration-500 focus-within:ring-2 focus-within:ring-[var(--sc-coral)] hover:shadow-[0_30px_60px_-30px_rgba(26,23,20,0.28)] sm:p-8"
      >
        {/* Full-card link as an overlay, so the product preview's own links aren't nested in it. */}
        <Link href={pack.href} className="absolute inset-0 z-20 rounded-[18px] focus:outline-none" aria-label={`${pack.name}: explore the pack`} />
        {/* Product shot, bleeding off the bottom-right like a photographed object. */}
        <motion.div
          style={{ y: visualY }}
          className={`pointer-events-none absolute transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] ${visualClassName}`}
        >
          <ProductIndustryPreview industryId={pack.id as MarketingVerticalScreenshotId} fill designWidth={pack.id === 'logistics' ? 760 : 620} className="h-full" />
        </motion.div>


        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            {featured ? (
              <p className="text-[14px] font-medium text-[var(--sc-ink-muted)]">Featured pack</p>
            ) : null}
            <h3
              className={`${featured ? 'mt-2 text-[clamp(1.75rem,3vw,2.5rem)]' : 'text-[clamp(1.375rem,2vw,1.75rem)]'} font-medium leading-tight tracking-[-0.025em] text-[var(--sc-ink)]`}
            >
              {pack.name}
            </h3>
          </div>
          <DotGrid />
        </div>

        <div className="relative z-10 mt-auto">
          <p
            className={`mb-6 max-w-[34rem] text-[15px] leading-[1.6] text-[var(--sc-ink)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              featured
                ? 'rounded-xl bg-white/85 p-4 backdrop-blur-sm sm:text-[16px]'
                : 'rounded-xl bg-white/90 p-4 backdrop-blur-sm lg:translate-y-3 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100'
            }`}
          >
            {pack.description}
          </p>
          <GrowArrow label="Explore the pack" />
        </div>
      </div>
    </motion.div>
  );
}

function LineupCard() {
  return (
    <motion.div
      variants={cardIn}
      transition={{ duration: 0.8, ease: MOTION_EASE }}
      className="sc-on-ink relative flex min-h-[380px] flex-col overflow-hidden rounded-[18px] bg-[var(--sc-coral)] p-7 text-white sm:p-9"
    >
      <div className="flex items-center gap-4 text-[14px] font-medium text-white/90">
        <span className="whitespace-nowrap">Industry packs</span>
        <span className="h-px flex-1 bg-white/45" aria-hidden />
        <span className="tabular-nums">
          {LIVE_COUNT}/{INDUSTRY_VERTICALS.length} live
        </span>
      </div>
      <h3 className="mt-8 text-[clamp(1.875rem,3vw,2.75rem)] font-medium leading-[1.06] tracking-[-0.03em]">
        Six packs.
        <br />
        One Stride core.
      </h3>
      <p className="mt-5 max-w-[22rem] text-[16px] leading-[1.6] text-white/90">
        Every pack adds sector workflows on the same login, records and compliance your team already
        uses.
      </p>
      <div className="mt-10 flex-1">
        <DotField />
      </div>
      <p className="mt-10 inline-flex items-center gap-2.5 self-start rounded-full bg-white/15 px-4 py-2 text-[14px] font-medium">
        <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
        Built on the Stride core
      </p>
    </motion.div>
  );
}

function CoreCard() {
  return (
    <motion.div
      variants={cardIn}
      transition={{ duration: 0.8, ease: MOTION_EASE }}
      className="sc-on-ink relative flex min-h-[380px] flex-col rounded-[18px] bg-[var(--sc-ink)] p-7 text-white sm:p-9"
    >
      <h3 className="text-[clamp(1.5rem,2.4vw,2rem)] font-medium leading-tight tracking-[-0.025em]">
        Stride Core <span className="text-white/45">included</span>
      </h3>
      <p className="mt-2 text-[16px] font-medium text-[var(--sc-coral)]">
        HR, payroll and finance under every pack.
      </p>
      <span className="mt-8 self-start rounded-md bg-white/10 px-2.5 py-1 text-[13px] text-white/80">
        Pricing from
      </span>
      <p className="mt-3 text-[clamp(2.75rem,5vw,4rem)] font-medium leading-none tracking-[-0.04em] text-white/80">
        <CountUp value={essentialsRate} prefix="KES " duration={1.6} />
      </p>
      <p className="mt-2 text-[14px] text-white/55">per employee a month, no minimums</p>
      <div className="mt-auto flex items-end justify-between gap-4 pt-10">
        <p className="text-[17px] font-medium text-white/85">See the platform</p>
        <Link
          href={MARKETING_ROUTES.platform}
          aria-label="See the platform"
          className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[var(--sc-coral)] text-white transition-transform hover:scale-105"
        >
          <ArrowIcon />
        </Link>
      </div>
    </motion.div>
  );
}

function BentoRow({ children, className }: { children: ReactNode; className: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ staggerChildren: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- section ---------- */

export function StudioCraftIndustriesSection() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="bg-white py-24 sm:py-28 lg:py-36" aria-labelledby="industries-heading">
      <StudioCraftContainer>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.8, ease: MOTION_EASE }}
          >
            <SectionBadge label={MARKETING_INDUSTRIES_SECTION.badge} />
            <h2
              id="industries-heading"
              className="max-w-[720px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)] [text-wrap:balance]"
            >
              Then it gets <span className="text-[var(--sc-coral)]">specific.</span>
            </h2>
          </motion.div>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.8, ease: MOTION_EASE, delay: 0.1 }}
            className="text-[16px] leading-[1.7] text-[var(--sc-ink-muted)]"
          >
            Every business runs the same core: people, payroll, finance. Stride adds the work that defines
            your industry as a pack on the same platform. Not a second system, and not an integration project.
          </motion.p>
        </div>

        <div className="mt-14 space-y-3 lg:mt-20">
          {/* Row 1: featured pack + lineup */}
          <BentoRow className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <PackCard
              pack={FEATURED}
              featured
              className="lg:min-h-[600px]"
              visualClassName="right-[-6%] top-[30%] h-[78%] w-[82%] sm:top-[24%]"
            />
            <LineupCard />
          </BentoRow>

          {/* Row 2: three packs */}
          <BentoRow className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROW_TWO.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                className="lg:min-h-[460px]"
                visualClassName="right-[-28%] top-[26%] h-[74%] w-[120%]"
              />
            ))}
          </BentoRow>

          {/* Row 3: two packs + core */}
          <BentoRow className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROW_THREE.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                className="lg:min-h-[460px]"
                visualClassName="right-[-28%] top-[26%] h-[74%] w-[120%]"
              />
            ))}
            <CoreCard />
          </BentoRow>
        </div>

        <div className="mt-10 flex justify-end">
          <Link
            href={MARKETING_ROUTES.industries}
            className="group inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--sc-coral)] transition-colors hover:text-[var(--sc-coral-deep)]"
          >
            All industries
            <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
              →
            </span>
          </Link>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
