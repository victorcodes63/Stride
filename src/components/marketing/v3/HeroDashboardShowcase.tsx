import { MARKETING_DASHBOARD_HERO } from '@/lib/marketing-config';
import { StrideHeroDashboardMockup } from '@/components/marketing/v3/StrideHeroDashboardMockup';

/** Desktop: live product screenshot. Mobile: lightweight UI mockup that scales cleanly. */
export function HeroDashboardShowcase() {
  const { src, width, height, alt } = MARKETING_DASHBOARD_HERO;

  return (
    <>
      <div className="sc-hero-dashboard-mobile md:hidden">
        <StrideHeroDashboardMockup />
      </div>

      <div className="sc-hero-dashboard-frame relative mx-auto hidden w-full overflow-hidden rounded-t-2xl border border-b-0 border-[#E6DED4]/90 bg-[#12100E] shadow-[0_28px_80px_-16px_rgba(26,23,20,0.22),0_8px_24px_-8px_rgba(26,23,20,0.12)] ring-1 ring-[#1A1714]/[0.04] md:block">
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
    </>
  );
}
