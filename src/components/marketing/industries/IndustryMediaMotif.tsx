'use client';

import { ProductIndustryPreview } from '@/components/marketing/product/ProductIndustryPreview';
import type { MarketingVerticalScreenshotId } from '@/lib/marketing-config';

type IndustryMediaMotifProps = {
  mediaKey: MarketingVerticalScreenshotId;
  className?: string;
};

/** Industry pack visual: the pack's real dashboard screen with demo data, cropped to 16:10. */
export function IndustryMediaMotif({ mediaKey, className = '' }: IndustryMediaMotifProps) {
  return (
    <div className={`aspect-[16/10] ${className}`.trim()}>
      <ProductIndustryPreview industryId={mediaKey} fill className="h-full" />
    </div>
  );
}
