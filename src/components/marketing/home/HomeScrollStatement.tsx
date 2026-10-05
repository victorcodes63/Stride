'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';

const STATEMENT =
  'Payroll, finance and compliance on one platform, so your team can stop reconciling and get back to running the business.';

/** Words from this phrase onwards land in coral once lit. */
const ACCENT_FROM = 'get back to running the business.';

function Word({
  word,
  progress,
  range,
  accent,
}: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
  accent: boolean;
}) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <span className="relative mr-[0.26em] inline-block">
      <motion.span style={{ opacity }} className={accent ? 'text-[var(--sc-coral)]' : undefined}>
        {word}
      </motion.span>
    </span>
  );
}

export function HomeScrollStatement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });

  const words = STATEMENT.split(' ');
  const accentStart = words.length - ACCENT_FROM.split(' ').length;

  return (
    <section className="bg-white py-28 sm:py-36 lg:py-44" aria-label="Why Stride">
      <StudioCraftContainer>
        <p className="mb-8 text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--sc-coral)]">
          Why Stride
        </p>
        <p
          ref={ref}
          className="max-w-[1080px] text-[clamp(2rem,4.6vw,4rem)] font-medium leading-[1.12] tracking-[-0.025em] text-[var(--sc-ink)]"
        >
          {reduceMotion
            ? words.map((word, index) => (
                <span
                  key={`${word}-${index}`}
                  className={`mr-[0.26em] inline-block ${index >= accentStart ? 'text-[var(--sc-coral)]' : ''}`}
                >
                  {word}
                </span>
              ))
            : words.map((word, index) => {
                const start = index / words.length;
                const end = start + 1 / words.length;
                return (
                  <Word
                    key={`${word}-${index}`}
                    word={word}
                    progress={scrollYProgress}
                    range={[start, end]}
                    accent={index >= accentStart}
                  />
                );
              })}
        </p>
      </StudioCraftContainer>
    </section>
  );
}
