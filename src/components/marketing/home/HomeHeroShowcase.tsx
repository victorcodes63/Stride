'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { MOTION_EASE } from '@/components/marketing/motion';

type HeroScreenshot = { src: string; alt: string; width: number; height: number };

/**
 * Hero product shot as a centred showpiece: it starts tilted back in 3D and
 * swings flat as the page scrolls, lit from below by a soft coral glow.
 */
export function HomeHeroShowcase({ screenshot }: { screenshot: HeroScreenshot }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  const rotateX = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [22, 0]);
  const scale = useTransform(progress, [0, 1], reduceMotion ? [1, 1] : [0.9, 1]);
  const glowOpacity = useTransform(progress, [0, 1], [0.35, 0.9]);

  return (
    <div ref={ref} className="relative mx-auto max-w-[1180px] [perspective:2200px]">
      {/* Coral light pooling under the frame. */}
      <motion.div
        aria-hidden
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute inset-x-[8%] -bottom-10 top-[30%] -z-10 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,84,54,0.45),rgba(255,84,54,0.12)_60%,transparent)] blur-3xl"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, translateY: 60 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 1.2, ease: MOTION_EASE, delay: 0.35 }}
      >
        <motion.div
          style={{ rotateX, scale, transformOrigin: '50% 0%' }}
          className="relative rounded-[22px] bg-gradient-to-b from-white/[0.14] to-white/[0.03] p-[1px] shadow-[0_60px_160px_-40px_rgba(0,0,0,0.9)]"
        >
          <div className="relative overflow-hidden rounded-[21px] bg-[#0F0D0B] p-2 sm:p-2.5">
            {/* Thin top highlight, like light catching the bezel. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />
            <div className="overflow-hidden rounded-[14px] ring-1 ring-white/[0.06]">
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
            </div>
            {/* Gradual fade into the band below — a long gradient, so no visible edge. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(to_bottom,rgba(26,23,20,0)_0%,rgba(26,23,20,0.35)_45%,rgba(26,23,20,0.85)_80%,#1A1714_100%)]"
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
