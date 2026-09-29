/**
 * Structured-data (schema.org JSON-LD) builders for the public marketing site.
 *
 * Site-wide Organization / WebSite / SoftwareApplication graph lives in the
 * root layout. These helpers cover per-page schema: FAQ content and breadcrumb
 * trails, which the layout graph cannot express.
 */
import { getMarketingSiteUrl } from '@/lib/marketing-config';

type FaqItem = { question: string; answer: string };

/** FAQPage schema — makes accordion Q&A machine-readable for search + AI overviews. */
export function faqPageJsonLd(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } as const;
}

export type Breadcrumb = { name: string; path: string };

/** BreadcrumbList schema — enables the breadcrumb trail rich result in SERPs. */
export function breadcrumbJsonLd(trail: readonly Breadcrumb[]) {
  const base = getMarketingSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${base}${crumb.path.startsWith('/') ? crumb.path : `/${crumb.path}`}`,
    })),
  } as const;
}
