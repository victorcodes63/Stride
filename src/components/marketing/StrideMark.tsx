'use client';

import { STRIDE_MARK_SRC, STRIDE_WORDMARK_SRC } from '@/lib/brand-constants';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type StrideLogoProps = {
  className?: string;
  /** Tailwind height class, e.g. h-7 */
  heightClass?: string;
  alt?: string;
};

/** Full Stride wordmark (lowercase logotype). */
export function StrideLogo({
  className,
  heightClass = 'h-7',
  alt = 'Stride',
}: StrideLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={STRIDE_WORDMARK_SRC}
      alt={alt}
      className={cn(
        heightClass,
        'w-auto max-w-none shrink-0 object-contain object-left',
        className,
      )}
      decoding="async"
    />
  );
}

type StrideMarkProps = {
  className?: string;
  /** @deprecated Mark is a fixed SVG gradient; variant is ignored. */
  variant?: 'coral' | 'white' | 'ink';
  alt?: string;
};

/** Circular Stride mark — favicon, compact chrome, mockups. */
export function StrideMark({
  className,
  variant: _variant = 'coral',
  alt = '',
}: StrideMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={STRIDE_MARK_SRC}
      alt={alt}
      aria-hidden={alt === ''}
      className={cn('aspect-square object-contain', className ?? 'h-8 w-8')}
      decoding="async"
    />
  );
}

type StrideWordmarkProps = {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
  variant?: 'coral' | 'white' | 'ink';
  onDark?: boolean;
};

/** Full wordmark lockup. */
export function StrideWordmark({
  className,
  markClassName = 'h-[26px]',
}: StrideWordmarkProps) {
  return <StrideLogo className={className} heightClass={markClassName} />;
}

export type StrideLockupTheme = 'on-ink' | 'on-coral';

type StrideWordmarkLockupProps = {
  theme?: StrideLockupTheme;
  boxed?: boolean;
  className?: string;
  markClassName?: string;
  wordClassName?: string;
};

export function StrideWordmarkLockup({
  theme: _theme = 'on-ink',
  boxed = false,
  className,
  markClassName = 'h-[26px]',
}: StrideWordmarkLockupProps) {
  const logo = <StrideLogo className={className} heightClass={markClassName} />;

  if (boxed) {
    return (
      <span className="inline-flex rounded-xl bg-white px-3 py-2 shadow-sm">{logo}</span>
    );
  }

  return logo;
}
