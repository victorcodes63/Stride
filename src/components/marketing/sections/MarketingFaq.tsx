'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MOTION_EASE, Reveal } from '@/components/marketing/motion';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';

type FaqItem = { question: string; answer: string };

export function MarketingFaq({ items }: { items: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();

  return (
    <section id="faq" className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-20">
          <div className="min-w-0">
            <Reveal>
              <SectionBadge number="7" label="FAQ" />
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="text-[clamp(1.75rem,6vw,3rem)] font-medium tracking-[-0.03em] text-[var(--sc-ink)]">
                Questions, <span className="text-[var(--sc-coral)]">answered.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-base leading-relaxed text-[var(--sc-ink-muted)]">
                Straight answers about compliance, modules, and getting started.
              </p>
            </Reveal>
          </div>

          <div className="min-w-0">
            {items.map((item, index) => {
              const open = openIndex === index;
              return (
                <Reveal key={item.question} delay={0.08 + index * 0.04}>
                  <div className="border-b border-[var(--sc-line)] first:border-t">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium tracking-tight text-[var(--sc-ink)] sm:gap-5 sm:py-6 sm:text-lg"
                      aria-expanded={open}
                      onClick={() => setOpenIndex(open ? null : index)}
                    >
                      {item.question}
                      <span
                        className="relative h-[18px] w-[18px] shrink-0 text-[var(--sc-coral)]"
                        aria-hidden
                      >
                        <span className="absolute left-0 top-[9px] h-0.5 w-5 rounded bg-current" />
                        <motion.span
                          className="absolute left-[9px] top-0 h-5 w-0.5 rounded bg-current"
                          animate={{ opacity: open ? 0 : 1 }}
                          transition={{ duration: reduceMotion ? 0 : 0.2, ease: MOTION_EASE }}
                        />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          key="content"
                          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.35, ease: MOTION_EASE }}
                          className="overflow-hidden"
                        >
                          <p className="pb-6 text-[15px] leading-relaxed text-[var(--sc-ink-muted)]">
                            {item.answer}
                          </p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
