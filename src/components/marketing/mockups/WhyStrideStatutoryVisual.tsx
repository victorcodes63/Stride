'use client';

import { ProductWhyStrideSlice } from '@/components/marketing/product/ProductSlices';

type WhyStrideStatutoryVisualProps = {
  className?: string;
};

/** Real statutory returns UI for the homepage "Why we built it" story. */
export function WhyStrideStatutoryVisual({ className = '' }: WhyStrideStatutoryVisualProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[1024px] ${className}`.trim()}>
      <ProductWhyStrideSlice className="w-full" designWidth={780} />
    </div>
  );
}
