'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { MOTION_EASE } from '@/components/marketing/motion';

type HeroScreenshot = { src: string; alt: string; width: number; height: number };

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

    </div>
  );
}
