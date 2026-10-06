import Link from 'next/link';
import type { ReactNode } from 'react';
import { Reveal } from '@/components/marketing/motion';

/** Plain text link with an arrow, used next to a primary CTA. */
export function EditorialTextLink({
  href,
  label,
  tone = 'light',
}: {
  href: string;
  label: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold transition-colors hover:text-[var(--sc-coral)] ${
        tone === 'dark' ? 'text-white' : 'text-[var(--sc-ink)]'
      }`}
    >
      {label}
      <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
        →
      </span>
    </Link>
  );
}

/** 6 × 5 dot grid with a few coral dots pulsing — plat-form's "core" motif. */
export function EditorialDotMatrix() {
  const lit = new Set([3, 8, 14, 19, 22, 27]);
  return (
    <>
      <div className="grid w-fit grid-cols-6 gap-3" aria-hidden>
        {Array.from({ length: 30 }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              lit.has(i) ? 'bg-[var(--sc-coral)] [animation:editorial-dot_2.8s_ease-in-out_infinite]' : 'bg-white/15'
            }`}
            style={lit.has(i) ? { animationDelay: `${(i % 5) * 0.45}s` } : undefined}
          />
        ))}
      </div>
      <style>{`@keyframes editorial-dot{0%,100%{opacity:.25}50%{opacity:1}}@media (prefers-reduced-motion:reduce){[class*="editorial-dot"]{animation:none!important;opacity:1}}`}</style>
    </>
  );
}

type ShowcaseFact = { value: ReactNode; label: string };

/**
 * Dark showcase panel: facts on the left, a product visual on the right.
 * The same shape as the /platform hero panel so inner pages feel related.
 */
export function EditorialShowcasePanel({
  eyebrow,
  counter,
  statement,
  facts,
  children,
}: {
  eyebrow: string;
  counter?: string;
  statement: ReactNode;
  facts?: readonly ShowcaseFact[];
  children: ReactNode;
}) {
  return (
    <Reveal delay={0.12}>
      <div className="sc-on-ink grid overflow-hidden rounded-[28px] bg-[var(--sc-ink)] p-3 text-white shadow-[0_40px_90px_-40px_rgba(26,23,20,0.7)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-white/55">{eyebrow}</p>
            {counter ? <p className="text-[13px] font-semibold text-white">{counter}</p> : null}
          </div>
          <p className="mt-5 text-[22px] font-medium leading-[1.25] tracking-[-0.02em] text-white">{statement}</p>
          <div className="mt-8">
            <EditorialDotMatrix />
          </div>
          {facts && facts.length > 0 ? (
            <dl className="mt-auto pt-10">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-4 border-t border-white/10 py-3.5">
                  <dt className="min-w-10 text-[20px] font-medium leading-none tracking-[-0.03em] text-white">{fact.value}</dt>
                  <dd className="text-[13px] leading-snug text-white/55">{fact.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-[20px] bg-[var(--sc-paper-2)]">
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.16),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto flex h-full min-w-0 max-w-[720px] items-center p-2.5 sm:p-4 lg:max-w-none lg:p-5">
            <div className="w-full min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** Numbered row list (plat-form "services" rows): index · title · body. */
export function EditorialNumberedRows({
  items,
}: {
  items: readonly { title: ReactNode; body: ReactNode }[];
}) {
  return (
    <div>
      {items.map((item, index) => (
        <Reveal key={index} delay={Math.min(index * 0.05, 0.2)}>
          <article className="group grid gap-3 border-t border-[var(--sc-line)] py-9 sm:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,420px)] lg:items-baseline lg:gap-12">
            <span className="text-[15px] font-medium text-[var(--sc-coral)]">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="text-[clamp(1.5rem,2.4vw,2rem)] font-medium leading-tight tracking-[-0.025em] text-[var(--sc-ink)] transition-colors duration-300 group-hover:text-[var(--sc-coral)]">
              {item.title}
            </h3>
            <p className="text-[15px] leading-[1.7] text-[var(--sc-ink-muted)] sm:col-start-2 lg:col-start-auto">{item.body}</p>
          </article>
        </Reveal>
      ))}
      <div className="border-t border-[var(--sc-line)]" />
    </div>
  );
}

/** Shared card surface used across inner pages. */
export const EDITORIAL_CARD =
  'rounded-[22px] border border-[var(--sc-line)] bg-white shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-34px_rgba(26,23,20,0.22)]';
