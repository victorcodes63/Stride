'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';
import { MOTION_EASE } from '@/components/marketing/motion';
import { INDUSTRY_VERTICALS, MARKETING_ROUTES, type MarketingVerticalScreenshotId } from '@/lib/marketing-config';
import { StudioCraftContainer } from './studio-craft-shared';

/** Cycle order for the featured / lineup cards. */
const ORDER: MarketingVerticalScreenshotId[] = [
  'logistics',
  'saccos',
  'healthcare',
  'hr_consultancy',
  'energy',
  'construction',
];

const AUTO_ADVANCE_MS = 6000;

const PACKS = ORDER.map((id) => INDUSTRY_VERTICALS.find((vertical) => vertical.id === id)).filter(
  (vertical): vertical is (typeof INDUSTRY_VERTICALS)[number] => Boolean(vertical),
);

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** 3×3 dot grid — the small handle in the featured card's corner. */
function DotGrid() {
  return (
    <span className="grid grid-cols-3 gap-[5px]" aria-hidden>
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="h-[3px] w-[3px] rounded-full bg-white/55" />
      ))}
    </span>
  );
}

export function StudioCraftIndustriesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const cardsInView = useInView(cardsRef, { margin: '-15% 0px -15% 0px' });

  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = PACKS[index]!;
  const total = PACKS.length;

  // Giant title drifts left as the section scrolls through, like plat-form's "Our Work".
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'start start'] });
  const titleX = useTransform(scrollYProgress, [0, 1], reduceMotion ? ['0%', '0%'] : ['14%', '0%']);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.6], reduceMotion ? [1, 1] : [0, 1]);

  const autoplay = !reduceMotion && cardsInView && !paused;

  const goTo = useCallback((next: number) => {
    setIndex(((next % total) + total) % total);
    setCycle((value) => value + 1);
  }, [total]);

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => goTo(index + 1), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, goTo, index, cycle]);

  return (
    <section
      ref={sectionRef}
      className="sc-on-ink relative overflow-hidden bg-[var(--sc-ink)] pb-24 pt-16 text-white sm:pb-28 lg:pb-36 lg:pt-20"
      aria-labelledby="industries-heading"
    >
      {/* Giant section title */}
      <StudioCraftContainer>
        <motion.h2
          id="industries-heading"
          style={{ x: titleX, opacity: titleOpacity }}
          className="select-none whitespace-nowrap text-[clamp(3.75rem,12vw,10rem)] font-medium leading-[0.9] tracking-[-0.05em] text-white/45"
        >
          Industries
        </motion.h2>
      </StudioCraftContainer>

      {/* Index row: number + rule | statement | aside */}
      <StudioCraftContainer>
        <div className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-[180px_minmax(0,1fr)_260px] lg:gap-12">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.7, ease: MOTION_EASE }}
            className="border-l-2 border-[var(--sc-coral)] pl-4"
          >
            <p className="text-[28px] font-light leading-none tracking-[-0.02em] text-white">002</p>
            <p className="mt-2 text-[15px] font-light text-white/55">stride—industries</p>
          </motion.div>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.9, ease: MOTION_EASE, delay: 0.08 }}
            className="max-w-[780px] text-[clamp(1.75rem,3.4vw,3rem)] font-medium leading-[1.14] tracking-[-0.03em] text-white/80"
          >
            Same core, sector depth. Each pack adds the work that defines your industry, on the records
            you already keep.
          </motion.p>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.7, ease: MOTION_EASE, delay: 0.16 }}
            className="text-[15px] leading-[1.6] text-white/55 lg:pt-2"
          >
            Same login, same compliance. Not a second system, and not an integration project.
          </motion.p>
        </div>
      </StudioCraftContainer>

      {/* Featured card + lineup card */}
      <StudioCraftContainer>
        <motion.div
          ref={cardsRef}
          initial={reduceMotion ? false : { opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 1, ease: MOTION_EASE }}
          className="mt-20 grid gap-2 lg:mt-28 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Featured pack */}
          <div className="relative min-h-[420px] overflow-hidden rounded-[10px] bg-gradient-to-b from-[#9A9A9F] via-[#6E6E74] to-[#2A2A2E] sm:min-h-[520px] lg:min-h-[600px]">
            <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-7 sm:p-9">
              <div>
                <p className="text-[17px] font-light text-white/85">Featured pack</p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={active.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.45, ease: MOTION_EASE }}
                    className="mt-3 text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight tracking-[-0.03em] text-white"
                  >
                    {active.name}
                  </motion.p>
                </AnimatePresence>
              </div>
              <DotGrid />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={reduceMotion ? false : { opacity: 0, scale: 1.06, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.8, ease: MOTION_EASE }}
                className="absolute inset-x-6 bottom-0 top-36 sm:inset-x-12 sm:top-40 lg:inset-x-16"
              >
                <div className="h-[118%] [&>*]:h-full">
                  <IndustryWireframePreview industryId={active.id as MarketingVerticalScreenshotId} />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Lineup card */}
          <div className="relative flex min-h-[420px] flex-col rounded-[10px] bg-[var(--sc-coral)] p-7 text-white sm:min-h-[520px] sm:p-10 lg:min-h-[600px]">
            <div className="flex items-center gap-4 text-[15px] font-light">
              <span className="whitespace-nowrap">Industry packs</span>
              <span className="relative h-px flex-1 bg-white/40">
                {autoplay ? (
                  <motion.span
                    key={`${active.id}-${cycle}`}
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-full origin-left bg-white"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
                  />
                ) : null}
              </span>
              <span className="italic tabular-nums">
                {pad(index + 1)}/{pad(total)}
              </span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: MOTION_EASE }}
                className="mt-10 flex flex-1 flex-col"
              >
                <h3 className="text-[clamp(2rem,3.4vw,3.25rem)] font-medium leading-[1.04] tracking-[-0.035em]">
                  {active.name}
                </h3>
                <p className="mt-8 text-[17px] leading-[1.55] text-white/90">{active.description}</p>
                <Link
                  href={active.href}
                  className="group mt-8 inline-flex items-center gap-2 self-start text-[15px] font-semibold text-white"
                >
                  <span className="border-b border-white/50 pb-0.5 transition-colors group-hover:border-white">
                    Explore the pack
                  </span>
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                    →
                  </span>
                </Link>
              </motion.div>
            </AnimatePresence>

            <div className="mt-10 flex items-center justify-between gap-2" role="tablist" aria-label="Industry packs">
              {PACKS.map((pack, packIndex) => (
                <button
                  key={pack.id}
                  type="button"
                  role="tab"
                  aria-selected={packIndex === index}
                  aria-label={pack.name}
                  onClick={() => goTo(packIndex)}
                  className="flex h-8 w-8 items-center justify-center"
                >
                  <span
                    className={`block rounded-full bg-white transition-all duration-300 ${
                      packIndex === index ? 'h-2 w-2 opacity-100' : 'h-1.5 w-1.5 opacity-45 hover:opacity-80'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="mt-10 flex justify-end">
          <Link
            href={MARKETING_ROUTES.industries}
            className="group inline-flex items-center gap-2 text-[15px] font-medium text-white/70 transition-colors hover:text-white"
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
