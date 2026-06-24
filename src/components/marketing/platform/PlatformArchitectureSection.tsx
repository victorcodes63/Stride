'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CoreDashboardWireframePreview,
  IndustryWireframePreview,
} from '@/components/marketing/mockups/IndustryWireframePreview';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import {
  CORE_CAPABILITIES,
  CORE_PACKS_EXPLAINER,
  INDUSTRY_DEEP_DIVES,
  VERTICAL_PACKS,
} from '@/components/marketing/industries/industries-content';

const PACK_COLORS = Object.fromEntries(VERTICAL_PACKS.map((p) => [p.id, p.color]));

// Unified layer list: core first, then the packs — one source of truth.
type Layer = {
  id: string;
  label: string;
  accent: string;
  status: 'always' | 'available' | 'coming_soon';
  positioning: string;
  detail: string;
  href?: string;
  ctaLabel?: string;
  mediaKey: string;
  isCore?: boolean;
};

const LAYERS: Layer[] = [
  {
    id: 'core',
    label: CORE_PACKS_EXPLAINER.coreLabel,
    accent: 'var(--sc-ink)',
    status: 'always',
    positioning: 'Shared platform layer — always on.',
    detail:
      'HR, payroll, finance, procurement, documents, projects and admin — one login, one data layer every vertical pack inherits.',
    mediaKey: 'core',
    isCore: true,
  },
  ...INDUSTRY_DEEP_DIVES.map((d) => ({
    id: d.id,
    label: d.name,
    accent: PACK_COLORS[d.id] ?? '#FF5436',
    status: d.status as 'available' | 'coming_soon',
    positioning: d.positioning,
    detail: d.strideRuns,
    href: d.href,
    ctaLabel: d.ctaLabel,
    mediaKey: d.mediaKey,
  })),
];

function statusMeta(status: Layer['status']) {
  if (status === 'always') return { label: 'Always on', live: false };
  if (status === 'available') return { label: 'Live', live: true };
  return { label: 'Roadmap', live: false };
}

/** One observer, one active index. Each step is a tall scroll section. */
function useActiveLayer(count: number) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      () => {
        // Pick the step whose center is closest to the viewport center.
        let best = -1;
        let bestDist = Infinity;
        const mid = window.innerHeight / 2;
        for (const el of stepRefs.current) {
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const dist = Math.abs(center - mid);
          if (dist < bestDist && rect.bottom > 0 && rect.top < window.innerHeight) {
            bestDist = dist;
            best = Number(el.dataset.index);
          }
        }
        if (best >= 0) setActive(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-20% 0px -20% 0px' },
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  const setStepRef = (i: number) => (el: HTMLElement | null) => {
    stepRefs.current[i] = el;
  };

  return { active, setStepRef };
}

function LayerVisual({ layer }: { layer: Layer }) {
  if (layer.isCore) {
    return <CoreDashboardWireframePreview className="h-full w-full" />;
  }
  return (
    <IndustryWireframePreview
      industryId={layer.mediaKey as 'logistics' | 'saccos' | 'healthcare' | 'energy' | 'construction'}
      className="h-full w-full"
    />
  );
}

export function PlatformArchitectureSection({ leadSection = false }: { leadSection?: boolean }) {
  const { active, setStepRef } = useActiveLayer(LAYERS.length);
  const reduceMotion = useReducedMotion();
  const revealY = leadSection ? 0 : 24;
  const activeLayer = LAYERS[active];

  return (
    <section
      className={
        leadSection
          ? 'border-b border-[var(--sc-line)] bg-[var(--sc-paper-2)] pt-4 pb-16 sm:pt-6 sm:pb-20 lg:pb-28'
          : 'border-y border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-16 sm:py-20 lg:py-28'
      }
    >
      <StudioCraftContainer>
        <Reveal y={revealY}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sc-coral)]">
            Platform architecture
          </p>
          <h2 className="mt-3 max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
            {CORE_PACKS_EXPLAINER.title}
          </h2>
        </Reveal>
        <Reveal delay={0.06} y={revealY}>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--sc-ink-muted)]">
            {CORE_PACKS_EXPLAINER.caption}
          </p>
        </Reveal>

        {/* DESKTOP: pinned visual on the left, scrolling steps on the right */}
        <div className="mt-12 hidden lg:mt-16 lg:grid lg:grid-cols-[1fr_minmax(380px,460px)] lg:gap-16">
          {/* Pinned stage */}
          <div className="relative">
            <div className="sticky top-[calc(var(--nav-h)+3rem)] flex h-[calc(100vh-var(--nav-h)-6rem)] min-h-[480px] items-center">
              {/* fixed-ratio rectangle — centered in the sticky zone, never stretches tall */}
              <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[var(--sc-ink)] p-3 shadow-[0_30px_70px_-32px_rgba(26,23,20,0.45)]">
                {/* accent rail keyed to the active layer */}
                <motion.div
                  className="absolute inset-x-0 top-0 z-10 h-1 origin-left"
                  style={{ backgroundColor: activeLayer.accent }}
                  aria-hidden
                />

                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="aspect-[16/10] w-full">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeLayer.id}
                        className="h-full w-full"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, scale: 1.01 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <LayerVisual layer={activeLayer} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* capability chips — clean caption row below the frame */}
                <div className="mt-3 flex flex-wrap gap-1.5 px-1">
                  {activeLayer.isCore ? (
                    CORE_CAPABILITIES.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/85"
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      on Stride Core
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scrolling steps */}
          <div>
            {LAYERS.map((layer, i) => {
              const meta = statusMeta(layer.status);
              const isActive = i === active;
              return (
                <article
                  key={layer.id}
                  data-index={i}
                  ref={setStepRef(i)}
                  className="flex min-h-[68vh] flex-col justify-center"
                >
                  <motion.div
                    animate={{ opacity: isActive ? 1 : 0.4 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="font-mono text-[11px] text-[var(--sc-ink-subtle,#8A8076)]">
                      {String(i).padStart(2, '0')} / {String(LAYERS.length - 1).padStart(2, '0')}
                      <span style={{ color: meta.live ? 'var(--sc-coral)' : undefined }}>
                        {' '}· {meta.label}
                      </span>
                    </p>
                    <h3 className="mt-2 text-2xl font-medium tracking-tight text-[var(--sc-ink)] sm:text-3xl">
                      {layer.label}
                    </h3>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--sc-ink-muted)]">
                      {layer.positioning}
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--sc-ink-subtle,#8A8076)]">
                      {layer.detail}
                    </p>
                    {layer.href && (
                      <Link
                        href={layer.href}
                        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition-all hover:gap-2.5"
                        style={{
                          color:
                            layer.accent === 'var(--sc-ink)' ? 'var(--sc-coral)' : layer.accent,
                        }}
                      >
                        {layer.ctaLabel}
                        <ArrowUpRight size={16} weight="bold" aria-hidden />
                      </Link>
                    )}
                  </motion.div>
                </article>
              );
            })}
          </div>
        </div>

        {/* MOBILE: simple, honest stacked cards — no sticky games */}
        <div className="mt-10 space-y-4 lg:hidden">
          {LAYERS.map((layer, i) => {
            const meta = statusMeta(layer.status);
            return (
              <Reveal key={layer.id} y={16}>
                <article className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--sc-ink)]">
                  <div className="h-1 w-full" style={{ backgroundColor: layer.accent }} aria-hidden />
                  <div className="p-5">
                    <p className="font-mono text-[11px] text-white/45">
                      {String(i).padStart(2, '0')}
                      <span
                        style={{
                          color: meta.live ? 'var(--sc-coral)' : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        {' '}· {meta.label}
                      </span>
                    </p>
                    <h3 className="mt-1 text-xl font-medium tracking-tight text-[var(--sc-paper)]">
                      {layer.label}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">{layer.positioning}</p>
                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
                      <div className="aspect-[16/10] w-full">
                        <LayerVisual layer={layer} />
                      </div>
                    </div>
                    {layer.href && (
                      <Link
                        href={layer.href}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{
                          color:
                            layer.accent === 'var(--sc-ink)' ? 'var(--sc-coral)' : layer.accent,
                        }}
                      >
                        {layer.ctaLabel}
                        <ArrowUpRight size={16} weight="bold" aria-hidden />
                      </Link>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </StudioCraftContainer>
    </section>
  );
}