'use client';

import { motion, useReducedMotion } from 'motion/react';
import { MOTION_EASE, MOTION_SPRING_SNAPPY } from '@/components/marketing/motion';
import { INDUSTRIES_HERO } from './industries-content';

function HeroWord({ word, index }: { word: string; index: number }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className="inline-block">{word}</span>;
  }

  return (
    <motion.span
      className="inline-block"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...MOTION_SPRING_SNAPPY,
        delay: 0.08 + index * 0.02,
      }}
    >
      {word}
      {index < INDUSTRIES_HERO.title.split(' ').length - 1 ? '\u00A0' : ''}
    </motion.span>
  );
}

export function IndustriesHero() {
  const reduceMotion = useReducedMotion();
  const words = INDUSTRIES_HERO.title.split(' ');

  return (
    <header className="relative overflow-hidden px-5 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-8 lg:px-12">
      {/* Coral gradient blob */}
      <div
        className="pointer-events-none absolute -left-[20%] top-[-10%] h-[480px] w-[640px] opacity-[0.35]"
        aria-hidden
      >
        <motion.div
          className="h-full w-full rounded-full"
          style={{
            background:
              'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(255,84,54,0.45) 0%, transparent 70%)',
            filter: 'blur(48px)',
          }}
          animate={reduceMotion ? undefined : { x: [0, 24, -12, 0], y: [0, -16, 8, 0] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 18, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </div>

      {/* Subtle grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1100px] min-w-0">
        <p className="mb-4 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sc-coral)] before:h-px before:w-5 before:shrink-0 before:bg-[var(--sc-coral)] sm:mb-5 sm:text-xs sm:before:w-6">
          — {INDUSTRIES_HERO.eyebrow.toUpperCase()}
        </p>

        <h1 className="font-heading text-[clamp(1.875rem,7vw,3.75rem)] font-extrabold tracking-[-0.04em] text-[var(--sc-ink)] sm:tracking-[-1.5px]">
          {words.map((word, i) => (
            <HeroWord key={`${word}-${i}`} word={word} index={i} />
          ))}
        </h1>

        <motion.p
          className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--sc-ink-muted)] sm:mt-5 sm:text-lg"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: MOTION_EASE, delay: 0.28 }}
        >
          {INDUSTRIES_HERO.subhead}
        </motion.p>
      </div>

      {/* Scroll cue */}
      <motion.div
        className="relative mx-auto mt-14 flex justify-center sm:mt-16"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        aria-hidden
      >
        <motion.div
          className="flex h-10 w-6 items-start justify-center rounded-full border border-[var(--sc-line)] pt-2"
          animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <span className="h-1.5 w-1 rounded-full bg-[var(--sc-coral)]" />
        </motion.div>
      </motion.div>
    </header>
  );
}
