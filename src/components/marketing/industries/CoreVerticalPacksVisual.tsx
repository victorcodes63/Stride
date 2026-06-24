'use client';

import { useEffect, useRef, useState } from 'react';
import type { MotionValue } from 'motion/react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  CORE_CAPABILITIES,
  CORE_PACKS_EXPLAINER,
  INDUSTRY_DEEP_DIVES,
  VERTICAL_PACKS,
} from './industries-content';
import { StaticStack } from './StaticStack';

const PACK_COUNT = VERTICAL_PACKS.length;
/** Viewport heights of scroll runway per pack, plus a little tail to settle. */
const SCROLL_SEGMENT_VH = 38;
const TAIL_VH = 16;

/** Short descriptor per pack, reused from deep-dive content. */
const PACK_DETAIL: Record<string, string> = Object.fromEntries(
  INDUSTRY_DEEP_DIVES.map((d) => [d.id, d.positioning]),
);

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

function PackTile({
  index,
  isActive,
  progress,
}: {
  index: number;
  isActive: boolean;
  progress: MotionValue<number>;
}) {
  const pack = VERTICAL_PACKS[index];
  const segment = 1 / PACK_COUNT;
  const start = index * segment;
  const end = start + segment * 0.62;
  const isFirst = index === 0;

  const opacity = useTransform(
    progress,
    isFirst ? [0, end] : [start, end],
    isFirst ? [1, 1] : [0, 1],
  );
  const x = useTransform(progress, [start, end], [isFirst ? 0 : 44, 0]);
  const y = useTransform(progress, [start, end], [isFirst ? 0 : 18, 0]);
  const scale = useTransform(progress, [start, end], [isFirst ? 1 : 0.96, 1]);
  const rotate = useTransform(progress, [start, end], [isFirst ? 0 : 1.6, 0]);

  return (
    <motion.div
      className="rounded-xl border bg-white px-4 py-3 transition-[box-shadow,border-color] duration-300"
      style={{
        opacity,
        x,
        y,
        scale,
        rotate,
        zIndex: index + 2,
        marginBottom: index < PACK_COUNT - 1 ? -8 : 0,
        borderColor: isActive ? pack.color : 'var(--sc-line)',
        boxShadow: isActive
          ? `0 14px 32px -12px ${pack.color}55`
          : '0 8px 24px -8px rgba(26,23,20,0.10)',
      }}
    >
      <span
        className="mr-2 inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: pack.color }}
        aria-hidden
      />
      <span className="text-sm font-semibold text-[var(--sc-ink)]">{pack.label}</span>
    </motion.div>
  );
}

function PinnedSequence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth the raw progress for buttery tile motion.
  const smooth = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    mass: 0.4,
  });

  // Drive the active pack + side panel off the raw value (more responsive).
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const i = Math.min(PACK_COUNT - 1, Math.max(0, Math.floor(v * PACK_COUNT)));
    setActiveIndex(i);
  });

  const railHeight = useTransform(smooth, [0, 1], ['0%', '100%']);
  const activePack = VERTICAL_PACKS[activeIndex];

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: `calc(${PACK_COUNT * SCROLL_SEGMENT_VH}vh + ${TAIL_VH}vh)` }}
    >
      <div className="sticky top-[var(--nav-h)] flex h-[calc(100vh-var(--nav-h))] items-start justify-center py-6 sm:py-8">
        <div className="mx-auto grid w-full max-w-4xl items-start gap-8 px-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10">
          {/* Diagram column */}
          <div className="relative flex min-w-0 gap-3 sm:gap-4">
            {/* Progress rail */}
            <div className="relative mt-1 w-px shrink-0 self-stretch bg-[var(--sc-line)]">
              <motion.div
                className="absolute left-0 top-0 w-px bg-[var(--sc-coral)]"
                style={{ height: railHeight }}
              />
            </div>

            <div className="relative flex flex-1 flex-col-reverse gap-1.5 sm:gap-2">
              {/* Core base */}
              <div className="relative z-[1] rounded-xl border border-[var(--sc-line)] bg-[var(--sc-ink)] p-3 text-white sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50">
                  {CORE_PACKS_EXPLAINER.coreLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                  {CORE_CAPABILITIES.map((cap) => (
                    <span
                      key={cap}
                      className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/90 sm:px-2.5 sm:py-1 sm:text-[11px]"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Docking packs */}
              <div className="relative z-[2] flex flex-col gap-1.5 sm:gap-2">
                {VERTICAL_PACKS.map((pack, i) => (
                  <PackTile
                    key={pack.id}
                    index={i}
                    isActive={i === activeIndex}
                    progress={smooth}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Synced detail panel */}
          <div className="lg:sticky lg:top-6">
            <p className="font-mono text-xs text-[var(--sc-ink-subtle,#8A8076)]">
              {String(activeIndex + 1).padStart(2, '0')} / {String(PACK_COUNT).padStart(2, '0')}
            </p>
            <div className="mt-3 min-h-[120px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePack.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: activePack.color }}
                    aria-hidden
                  />
                  <h3 className="mt-3 font-heading text-2xl font-extrabold tracking-[-0.02em] text-[var(--sc-ink)]">
                    {activePack.label}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--sc-ink-muted)]">
                    {PACK_DETAIL[activePack.id]}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders exactly one diagram: SSR/static stack first (and on mobile or
 * reduced-motion), then the pinned scroll sequence on desktop once mounted.
 */
export function CoreVerticalPacksVisual({ pinnedScroll = true }: { pinnedScroll?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const isDesktop = useIsDesktop();

  useEffect(() => setMounted(true), []);

  const showPinned = pinnedScroll && mounted && isDesktop && !reduceMotion;
  return showPinned ? <PinnedSequence /> : <StaticStack />;
}