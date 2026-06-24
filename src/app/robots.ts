import type { MetadataRoute } from 'next';

import { getMarketingSiteUrl } from '@/lib/marketing-config';

const baseUrl = getMarketingSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
