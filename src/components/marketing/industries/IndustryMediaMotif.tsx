'use client';

import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';
import type { MarketingVerticalScreenshotId } from '@/lib/marketing-config';
import { MARKETING_VERTICAL_SCREENSHOTS } from '@/lib/marketing-config';

type IndustryMediaMotifProps = {
  mediaKey: MarketingVerticalScreenshotId;
  className?: string;
};

export function IndustryMediaMotif({ mediaKey, className = '' }: IndustryMediaMotifProps) {
  const shot = MARKETING_VERTICAL_SCREENSHOTS[mediaKey];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#12100E] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)] ${className}`.trim()}
      role="img"
      aria-label={`${shot.moduleLabel} — ${shot.screenTitle}`}
    >
      <div className="aspect-[16/10] bg-[#12100E] p-3 sm:p-4">
        <IndustryWireframePreview industryId={mediaKey} className="h-full" />
      </div>
    </div>
  );
}
