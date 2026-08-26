import type { MetadataRoute } from 'next';

import { getMarketingSiteUrl, INDUSTRY_VERTICALS, MARKETING_ROUTES } from '@/lib/marketing-config';

/** Paths Google can crawl as distinct URLs (no #fragments — crawlers ignore them). */
function isSitemapablePath(path: string): boolean {
  return Boolean(path) && !path.includes('#');
}

/** Static marketing paths included in sitemap.xml (RAV-47). */
export const MARKETING_SITEMAP_STATIC_PATHS: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}[] = [
  { path: MARKETING_ROUTES.home, changeFrequency: 'weekly', priority: 1 },
  { path: MARKETING_ROUTES.platform, changeFrequency: 'monthly', priority: 0.9 },
  { path: MARKETING_ROUTES.industries, changeFrequency: 'monthly', priority: 0.9 },
  // HR Consultancy still deep-links via `/industries#hr-consultancy` in the UI;
  // only real page paths (e.g. `/industries/logistics`) enter the sitemap.
  ...INDUSTRY_VERTICALS.filter(
    (v) => v.status === 'available' && isSitemapablePath(v.href),
  ).map((v) => ({
    path: v.href,
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  })),
  { path: MARKETING_ROUTES.pricing, changeFrequency: 'monthly', priority: 0.9 },
  { path: MARKETING_ROUTES.about, changeFrequency: 'monthly', priority: 0.8 },
  { path: MARKETING_ROUTES.contact, changeFrequency: 'monthly', priority: 0.9 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
].filter((entry) => isSitemapablePath(entry.path));

export function buildMarketingSitemapEntries(
  baseUrl = getMarketingSiteUrl(),
  lastModified = new Date(),
): MetadataRoute.Sitemap {
  return MARKETING_SITEMAP_STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? baseUrl : `${baseUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
