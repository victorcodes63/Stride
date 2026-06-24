'use client';

import { usePublicBrand } from '@/components/BrandProvider';

const toneClasses = {
  info: 'dash-banner-info',
  warning: 'dash-banner-warning',
  success: 'dash-banner-success',
};

export function DashboardSetupBanner() {
  const brand = usePublicBrand();
  if (!brand.dashboardBannerEnabled || !brand.dashboardBannerText.trim()) return null;
  const tone = toneClasses[brand.dashboardBannerTone] ?? toneClasses.info;
 return (
 <div className={`mb-5 sm:mb-6 dashboard-surface border px-4 py-3 text-sm shadow-sm ${tone}`} role="status">
      {brand.dashboardBannerText}
    </div>
  );
}
