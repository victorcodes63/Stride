import type { ReactNode } from 'react';

type MarketingEyebrowProps = {
  children: ReactNode;
  tone?: 'light' | 'dark';
  /** Short coral rule before label — off for centred eyebrows. */
  withRule?: boolean;
  className?: string;
};

export function MarketingEyebrow({
  children,
  tone = 'light',
  withRule = true,
  className = '',
}: MarketingEyebrowProps) {
  return (
    <p
      className={`mb-[18px] text-xs font-semibold uppercase tracking-[0.1em] ${
        withRule ? 'flex items-center gap-2.5 before:h-px before:w-6 before:shrink-0 before:bg-[var(--pub-primary)]' : ''
      } ${
        tone === 'dark' ? 'text-[var(--pub-primary)]' : 'text-[var(--pub-primary-hover)]'
      } ${className}`.trim()}
    >
      {children}
    </p>
  );
}
