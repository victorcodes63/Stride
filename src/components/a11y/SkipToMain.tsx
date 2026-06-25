import Link from 'next/link';

type SkipToMainProps = {
  targetId?: string;
  label?: string;
  className?: string;
};

/** WCAG 2.4.1 — bypass repeated blocks (sidebar/header). */
export function SkipToMain({
  targetId = 'main-content',
  label = 'Skip to main content',
  className = '',
}: SkipToMainProps) {
  return (
    <Link
      href={`#${targetId}`}
      className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-neutral-900 focus:shadow-lg focus:ring-2 focus:ring-[var(--brand-navy)] ${className}`}
    >
      {label}
    </Link>
  );
}
