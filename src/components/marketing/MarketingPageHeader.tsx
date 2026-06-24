import type { ReactNode } from 'react';

type MarketingPageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
  visual?: ReactNode;
};

export function MarketingPageHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
  visual,
}: MarketingPageHeaderProps) {
  const centered = align === 'center';

  return (
    <header className={`px-5 pb-10 pt-4 sm:px-8 sm:pb-12 sm:pt-6 lg:px-12 ${className}`.trim()}>
      <div className={`mx-auto max-w-[1100px] min-w-0 ${centered ? 'text-center' : ''}`}>
        <p
          className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--pub-primary)] sm:mb-5 sm:text-xs ${
            centered
              ? ''
              : 'flex items-center gap-2.5 before:h-px before:w-5 before:shrink-0 before:bg-[var(--pub-primary)] sm:before:w-6'
          }`}
        >
          {eyebrow}
        </p>
        <h1
          className={`font-heading text-[clamp(1.875rem,7vw,3.75rem)] font-extrabold tracking-[-0.04em] text-pub-ink sm:tracking-[-1.5px] ${
            centered ? 'mx-auto max-w-3xl' : 'max-w-3xl'
          }`}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={`mt-4 text-base leading-relaxed text-pub-ink-muted sm:mt-5 sm:text-lg ${
              centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'
            }`}
          >
            {description}
          </p>
        ) : null}
        {visual ? (
          <div
            className={`mt-8 min-w-0 max-w-full overflow-hidden sm:mt-12 ${centered ? 'mx-auto max-w-4xl' : 'max-w-4xl'}`}
          >
            {visual}
          </div>
        ) : null}
      </div>
    </header>
  );
}
