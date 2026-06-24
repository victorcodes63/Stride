import type { ReactNode } from 'react';
import { marketingAppHostLabel } from '@/lib/marketing-config';

type MarketingProductShotProps = {
  browserUrl?: string;
  imageSrc?: string;
  imageAlt?: string;
  placeholderTitle: string;
  placeholderSub: ReactNode;
  aspectClassName?: string;
  className?: string;
};

export function MarketingProductShot({
  browserUrl = marketingAppHostLabel('/dashboard'),
  imageSrc,
  imageAlt = 'Stride product screenshot',
  placeholderTitle,
  placeholderSub,
  aspectClassName = 'aspect-[16/10]',
  className = '',
}: MarketingProductShotProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <div
        className="pointer-events-none absolute left-1/2 bottom-[-40px] h-[120px] w-[80%] -translate-x-1/2 rounded-full opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 0%, rgba(255,84,54,0.18) 0%, transparent 70%)',
          filter: 'blur(28px)',
        }}
        aria-hidden
      />
      <div className="overflow-hidden rounded-t-[14px] border border-white/[0.08] bg-[#13100D] shadow-[0_-1px_0_rgba(255,255,255,0.04),0_40px_100px_-20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2 border-b border-white/[0.05] bg-[#1B1712] px-4 py-3">
          <span className="h-[11px] w-[11px] rounded-full bg-[#FF5F57]" aria-hidden />
          <span className="h-[11px] w-[11px] rounded-full bg-[#FEBC2E]" aria-hidden />
          <span className="h-[11px] w-[11px] rounded-full bg-[#28C840]" aria-hidden />
          <span className="ml-3.5 max-w-[340px] flex-1 rounded-md border border-white/[0.06] bg-[#0E0C0A] px-3 py-1.5 text-center text-xs text-pub-ink-subtle">
            {browserUrl}
          </span>
        </div>
        <div
          className={`relative flex items-center justify-center bg-gradient-to-br from-[#1A1612] to-[#221C16] ${aspectClassName}`}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={imageAlt}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="px-10 py-8 text-center text-pub-ink-subtle">
              <p className="font-heading text-base font-semibold text-[#F0EFE9]/60">{placeholderTitle}</p>
              <div className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed">{placeholderSub}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
