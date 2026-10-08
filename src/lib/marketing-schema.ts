/**
 * Structured-data (schema.org JSON-LD) builders for the public marketing site.
 *
 * Site-wide Organization / WebSite / SoftwareApplication graph lives in the
 * root layout. These helpers cover per-page schema: FAQ, breadcrumbs, offers.
 */
import { brandConfig } from '@/lib/brand.config';
import { getMarketingSiteUrl } from '@/lib/marketing-config';
import { PRICING_PLANS } from '@/lib/pricing';

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

/** WebPage schema for keyword landing pages. */
export function webPageJsonLd(input: { name: string; description: string; path: string }) {
  const base = getMarketingSiteUrl().replace(/\/$/, '');
  const url = `${base}${input.path.startsWith('/') ? input.path : `/${input.path}`}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url,
    isPartOf: { '@type': 'WebSite', name: brandConfig.productName, url: base },
    about: { '@id': `${base}/#software` },
  } as const;
}

/**
 * AggregateOffer for Stride SoftwareApplication — rates from pricing.ts so
 * marketing schema cannot drift from published list prices.
 */
export function softwareAggregateOfferJsonLd() {
  const base = getMarketingSiteUrl().replace(/\/$/, '');
  const metered = PRICING_PLANS.filter((p) => p.rateKesPerEmployee != null);
  const lows = metered.map((p) => p.rateKesPerEmployee!);
  const highs = metered.map((p) => p.rateKesPerEmployee!);

  return {
    '@type': 'AggregateOffer',
    priceCurrency: 'KES',
    lowPrice: String(Math.min(...lows)),
    highPrice: String(Math.max(...highs)),
    offerCount: PRICING_PLANS.length,
    url: `${base}/pricing`,
    offers: PRICING_PLANS.map((plan) =>
      plan.rateKesPerEmployee != null
        ? {
            '@type': 'Offer',
            name: plan.name,
            price: String(plan.rateKesPerEmployee),
            priceCurrency: 'KES',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: String(plan.rateKesPerEmployee),
              priceCurrency: 'KES',
              unitText: 'employee / month',
            },
            url: `${base}/pricing`,
            availability: 'https://schema.org/InStock',
          }
        : {
            '@type': 'Offer',
            name: plan.name,
            price: '0',
            priceCurrency: 'KES',
            description: plan.customPriceLabel ?? 'Custom pricing',
            url: `${base}/contact`,
            availability: 'https://schema.org/InStock',
          },
    ),
  } as const;
}

/** SoftwareApplication + offers for the pricing page (and layout graph sync). */
export function softwareApplicationJsonLd(description?: string) {
  const base = getMarketingSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${base}/#software`,
    name: brandConfig.productName,
    description: description ?? brandConfig.tagline,
    url: base,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'HRIS',
    operatingSystem: 'Web',
    offers: softwareAggregateOfferJsonLd(),
    publisher: { '@id': `${base}/#organization` },
    areaServed: ['KE', 'UG', 'TZ', 'RW'],
    keywords: 'HRIS Kenya, HRMS Kenya, payroll software Kenya, PAYE, NSSF, SHIF, M-Pesa',
  } as const;
}
