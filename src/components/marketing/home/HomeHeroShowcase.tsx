'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { MOTION_EASE } from '@/components/marketing/motion';

type HeroScreenshot = { src: string; alt: string; width: number; height: number };

/**
 * Illustrative activity cards that float over the product shot. Demo data in the
 * same spirit as the dashboard mock — swap or remove freely.
 */
const ACTIVITY_CARDS = [
  {
    title: 'Payroll approved',
    detail: '248 employees · September run',
    tone: 'coral' as const,
    className: '-left-10 top-[18%]',
    delay: 0.9,
    drift: 7,
  },
  {
    title: 'M-Pesa batch sent',
    detail: 'KES 4.2M to 248 wallets',
    tone: 'ink' as const,
    className: '-right-6 top-[46%]',
    delay: 1.3,
    drift: -8,
  },
  {
    title: 'Statutory returns ready',
    detail: 'PAYE · NSSF · SHIF · Housing Levy',
    tone: 'paper' as const,
    className: 'left-[10%] -bottom-7',
    delay: 1.7,
    drift: 6,
  },
];

const TONE_CLASSES = {
  coral: 'bg-[var(--sc-coral)] text-white',
  ink: 'bg-[#26221E] text-[#FBF8F4] ring-1 ring-white/10',
  paper: 'bg-[#FBF8F4] text-[var(--sc-ink)]',
} as const;

const DOT_CLASSES = {
  coral: 'bg-white',
  ink: 'bg-[#4ADE80]',
  paper: 'bg-[var(--sc-coral)]',
} as const;

export function HomeHeroShowcase({ screenshot }: { screenshot: HeroScreenshot }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // Gentle lift and settle as the hero scrolls away.
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [24, -36]);
  const rotateX = useTransform(scrollYProgress, [0.2, 0.6], reduceMotion ? [0, 0] : [6, 0]);

  return (
    <div ref={ref} className="relative [perspective:1600px]">
      {/* Entrance lives on this wrapper; scroll-driven lift lives on the frame below. */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, translateY: 40 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 1.1, ease: MOTION_EASE, delay: 0.25 }}
      >
      <motion.div
        style={{ y, rotateX }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#12100E] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.75)] ring-1 ring-white/5"
      >
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 truncate font-mono text-[11px] text-white/35">app.getstride.co.ke/dashboard</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshot.src}
          alt={screenshot.alt}
          width={screenshot.width}
          height={screenshot.height}
          decoding="async"
          fetchPriority="high"
          className="block h-auto w-full"
        />
        {/* Slow sheen across the glass so the shot never feels static. */}
        {reduceMotion ? null : (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
            animate={{ x: ['0%', '420%'] }}
            transition={{ duration: 5.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 4, delay: 2 }}
          />
        )}
      </motion.div>
      </motion.div>

      {ACTIVITY_CARDS.map((card) => (
        <motion.div
          key={card.title}
          aria-hidden
          className={`absolute z-10 ${card.className}`}
          initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: MOTION_EASE, delay: card.delay }}
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, card.drift, 0] }}
            transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity, delay: card.delay + 0.7 }}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)] ${TONE_CLASSES[card.tone]}`}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {reduceMotion ? null : (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${DOT_CLASSES[card.tone]}`} />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${DOT_CLASSES[card.tone]}`} />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">{card.title}</span>
              <span className="mt-0.5 block whitespace-nowrap text-[11.5px] leading-tight opacity-70">{card.detail}</span>
            </span>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
