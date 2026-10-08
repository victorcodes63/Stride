import type { MetadataRoute } from 'next';

import { getMarketingSiteUrl } from '@/lib/marketing-config';
import { getSiteMode } from '@/lib/site-mode';

const baseUrl = getMarketingSiteUrl();

export default function robots(): MetadataRoute.Robots {
  const mode = getSiteMode();
  const disallow = ['/dashboard/', '/api/', '/ess/', '/demo-access', '/quote', '/interview'];

  // Careers apply URLs belong on the app/tenant host, not the marketing crawl surface.
  if (mode === 'marketing') {
    disallow.push('/careers/');
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
