import type { MetadataRoute } from 'next';

import { getMarketingSiteUrl } from '@/lib/marketing-config';

export const revalidate = 3600;

const baseUrl = getMarketingSiteUrl();

const marketingRoutes: MetadataRoute.Sitemap = [
  { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
  { url: `${baseUrl}/platform`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  { url: `${baseUrl}/industries`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  { url: `${baseUrl}/careers`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [...marketingRoutes];

  try {
    const jobsRes = await fetch(`${baseUrl}/api/jobs?activeOnly=true`, {
      next: { revalidate: 3600 },
    });

    if (jobsRes.ok) {
      const jobs = (await jobsRes.json()) as Array<{ id: string; slug?: string | null }>;
      for (const job of Array.isArray(jobs) ? jobs : []) {
        const path = job.slug ?? job.id;
        routes.push({
          url: `${baseUrl}/careers/apply/${path}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch {
    // Build-time or offline — static marketing routes still ship.
  }

  return routes;
}
