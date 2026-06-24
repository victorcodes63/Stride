'use client';

import { MARKETING_VERTICAL_SCREENSHOTS, type MarketingVerticalScreenshotId } from '@/lib/marketing-config';

type IndustryMediaMotifProps = {
  mediaKey: MarketingVerticalScreenshotId;
  className?: string;
};

function MotifFrame({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#12100E] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)] ${className}`.trim()}
      role="img"
      aria-label={`${title} — ${subtitle}`}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#1C1916] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
            {title}
          </p>
          <p className="text-sm font-medium text-white/90">{subtitle}</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-[var(--sc-coral)]" aria-hidden />
      </div>
      <div className="bg-[#12100E] p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function IndustryMediaMotif({ mediaKey, className = '' }: IndustryMediaMotifProps) {
  const shot = MARKETING_VERTICAL_SCREENSHOTS[mediaKey];

  return (
    <MotifFrame title={shot.moduleLabel} subtitle={shot.screenTitle} className={className}>
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#1C1916]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.src}
          alt={shot.alt}
          className="w-full object-cover object-top"
          decoding="async"
        />
      </div>
    </MotifFrame>
  );
}
