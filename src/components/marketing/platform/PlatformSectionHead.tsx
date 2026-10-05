import type { ReactNode } from 'react';
import { Reveal } from '@/components/marketing/motion';

type PlatformSectionHeadProps = {
  /** Two-digit section index, e.g. "02". */
  index: string;
  /** Eyebrow label, same style as the homepage section badges. */
  label: string;
  /** Section heading — same type scale as the homepage H2s. */
  title: ReactNode;
  /** Supporting copy on the right. */
  note?: ReactNode;
  id?: string;
  tone?: 'light' | 'dark';
};

/** Total sections on /platform with an index, for the "02 / 06" counter. */
const TOTAL = '06';

/**
 * Platform-page section header. Uses the homepage type scale (13px eyebrow, 2.25–4rem H2,
 * 16px intro) and adds a hairline index row so the page keeps its own editorial rhythm.
 */
export function PlatformSectionHead({ index, label, title, note, id, tone = 'light' }: PlatformSectionHeadProps) {
  const dark = tone === 'dark';
  return (
    <div>
      <Reveal>
        <div
          className={`flex items-center justify-between border-t pt-5 ${dark ? 'border-white/10' : 'border-[var(--sc-line)]'}`}
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--sc-coral)]">{label}</p>
          <p className={`text-[13px] font-medium ${dark ? 'text-white/40' : 'text-[var(--sc-ink-subtle)]'}`}>
            {index} / {TOTAL}
          </p>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-6 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
        <Reveal delay={0.04}>
          <h2
            id={id}
            className={`max-w-[760px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] [text-wrap:balance] ${
              dark ? 'text-white' : 'text-[var(--sc-ink)]'
            }`}
          >
            {title}
          </h2>
        </Reveal>
        {note ? (
          <Reveal delay={0.08}>
            <div className={`text-[16px] leading-[1.7] ${dark ? 'text-white/60' : 'text-[var(--sc-ink-muted)]'}`}>{note}</div>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}
