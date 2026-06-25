import type { MetadataRoute } from 'next';

import { getMarketingSiteUrl } from '@/lib/marketing-config';
import { buildMarketingSitemapEntries } from '@/lib/marketing-sitemap';

export const revalidate = 3600;

const baseUrl = getMarketingSiteUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = buildMarketingSitemapEntries(baseUrl);

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
