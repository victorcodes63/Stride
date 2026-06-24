import { MARKETING_STATUTORY_SCREENSHOT } from '@/lib/marketing-config';

type WhyStrideStatutoryVisualProps = {
  className?: string;
};

/** Statutory screengrab — same floating card treatment as the homepage hero dashboard. */
export function WhyStrideStatutoryVisual({ className = '' }: WhyStrideStatutoryVisualProps) {
  const { src, width, height, alt } = MARKETING_STATUTORY_SCREENSHOT;

  return (
    <div
      className={`relative mx-auto w-full max-w-[1024px] overflow-hidden rounded-2xl border border-[#E6DED4]/90 bg-[#12100E] shadow-[0_28px_80px_-16px_rgba(26,23,20,0.22),0_8px_24px_-8px_rgba(26,23,20,0.12)] ring-1 ring-[#1A1714]/[0.04] ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}
