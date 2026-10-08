'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { getMarketingHomeUrl } from '@/lib/marketing-config';

type MarketingCloseButtonProps = {
  className?: string;
  label?: string;
  /** Light surfaces (book demo) use ink chrome; dark is the legacy fullscreen default. */
  tone?: 'dark' | 'light';
};

export function MarketingCloseButton({
  className = '',
  label = 'Close and return home',
  tone = 'dark',
}: MarketingCloseButtonProps) {
  const router = useRouter();
  const homeHref = getMarketingHomeUrl();
  const toneClass =
    tone === 'light'
      ? 'border-[var(--sc-line)] text-[var(--sc-ink-muted)] hover:border-[var(--sc-ink)]/25 hover:text-[var(--sc-ink)] bg-white/80 backdrop-blur-sm'
      : 'border-white/10 text-[#FFFFFF]/70 hover:border-white/20 hover:text-[#FFFFFF]';

  return (
    <Link
      href={homeHref}
      onClick={(event) => {
        if (typeof window === 'undefined' || window.history.length <= 1) return;

        const referrer = document.referrer;
        if (!referrer) return;

        try {
          if (new URL(referrer).origin === window.location.origin) {
            event.preventDefault();
            router.back();
          }
        } catch {
          /* use default link navigation */
        }
      }}
      className={`absolute right-5 top-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border transition-colors sm:right-8 sm:top-8 ${toneClass} ${className}`.trim()}
      aria-label={label}
    >
      <X className="h-4 w-4" aria-hidden />
    </Link>
  );
}
