import { MARKETING_DASHBOARD_HERO } from '@/lib/marketing-config';

/** Dashboard shot clipped to the hero viewport — top-aligned so chrome + greeting stay visible. */
export function HeroDashboardShowcase() {
  const { src, width, height, alt } = MARKETING_DASHBOARD_HERO;

  return (
    <div className="sc-hero-dashboard-frame relative mx-auto w-full overflow-hidden rounded-t-2xl border border-b-0 border-[#E6DED4]/90 bg-[#12100E] shadow-[0_28px_80px_-16px_rgba(26,23,20,0.22),0_8px_24px_-8px_rgba(26,23,20,0.12)] ring-1 ring-[#1A1714]/[0.04]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        fetchPriority="high"
        className="sc-hero-dashboard-image block"
      />
    </div>
  );
}
