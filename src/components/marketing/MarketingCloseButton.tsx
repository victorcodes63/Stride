'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { getMarketingHomeUrl } from '@/lib/marketing-config';

type MarketingCloseButtonProps = {
  className?: string;
  label?: string;
};

export function MarketingCloseButton({
  className = '',
  label = 'Close and return home',
}: MarketingCloseButtonProps) {
  const router = useRouter();
  const homeHref = getMarketingHomeUrl();

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
      className={`absolute right-5 top-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#fbf8f4]/70 transition-colors hover:border-white/20 hover:text-[#fbf8f4] sm:right-8 sm:top-8 ${className}`.trim()}
      aria-label={label}
    >
      <X className="h-4 w-4" aria-hidden />
    </Link>
  );
}
