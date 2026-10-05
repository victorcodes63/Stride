import type { ReactNode } from 'react';
import { Reveal } from '@/components/marketing/motion';

type PlatformSectionHeadProps = {
  /** Two-digit section index, e.g. "02". */
  index: string;
  /** Short label under the index. */
  label: string;
  /** Oversized section title. */
  title: ReactNode;
  /** Statement in the middle column. */
  statement: ReactNode;
  /** Small supporting note on the right. */
  note?: ReactNode;
  id?: string;
  tone?: 'light' | 'dark';
  /** Render the title as the page H1 instead of an H2. */
  as?: 'h1' | 'h2' | 'p';
};

/**
 * Platform-page section header: an oversized title, then an index / statement / note row
 * under a hairline. Gives /platform its own editorial rhythm, distinct from the homepage.
 */
export function PlatformSectionHead({
  index,
  label,
  title,
  statement,
  note,
  id,
  tone = 'light',
  as: Title = 'h2',
}: PlatformSectionHeadProps) {
  const dark = tone === 'dark';
  return (
    <div>
      <Reveal>
        <Title
          id={id}
          className={`text-[clamp(3rem,9.5vw,8.75rem)] font-medium leading-[0.92] tracking-[-0.045em] ${
            dark ? 'text-white' : 'text-[var(--sc-ink)]'
          }`}
        >
          {title}
        </Title>
      </Reveal>

      <Reveal delay={0.06}>
        <div
          className={`mt-10 grid gap-6 border-t pt-7 sm:mt-12 lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:gap-12 ${
            dark ? 'border-white/10' : 'border-[var(--sc-line)]'
          }`}
        >
          <div className="border-l-2 border-[var(--sc-coral)] pl-3">
            <p className={`text-[15px] font-semibold leading-none ${dark ? 'text-white' : 'text-[var(--sc-ink)]'}`}>
              {index}
            </p>
            <p className={`mt-1.5 text-[13px] ${dark ? 'text-white/45' : 'text-[var(--sc-ink-subtle)]'}`}>{label}</p>
          </div>
          <p
            className={`max-w-[34rem] text-[clamp(1.375rem,2.4vw,2rem)] font-medium leading-[1.2] tracking-[-0.02em] [text-wrap:balance] ${
              dark ? 'text-white' : 'text-[var(--sc-ink)]'
            }`}
          >
            {statement}
          </p>
          {note ? (
            <div className={`text-[14px] leading-[1.65] ${dark ? 'text-white/55' : 'text-[var(--sc-ink-muted)]'}`}>
              {note}
            </div>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}
