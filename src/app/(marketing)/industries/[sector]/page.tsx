import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INDUSTRY_VERTICALS } from '@/lib/marketing-config';
import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import { marketingMetadata } from '@/lib/marketing-metadata';

/**
 * Reserved for `coming_soon` industry verticals only.
 *
 * Live verticals (status `available`) ship as dedicated static pages under
 * `/industries/<name>` (logistics, saccos, healthcare, energy, construction).
 * Those win over this catch-all, so this route never serves them — it
 * `notFound()`s if a sector is missing or already available.
 *
 * Keep this file when adding a new roadmap vertical: set status to
 * `coming_soon` in INDUSTRY_VERTICALS and this page becomes its waitlist
 * surface. Forced dynamic because `generateStaticParams` would return []
 * while every vertical is `available`, which breaks Next.js page-data
 * collection for this segment.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ sector: string }> };

export async function generateMetadata({ params }: Props) {
  const { sector } = await params;
  const vertical = INDUSTRY_VERTICALS.find((v) => v.id === sector);
  if (!vertical || vertical.status === 'available') {
    return marketingMetadata({
      title: 'Industry',
      description: 'Stride industry verticals for East African businesses.',
      path: '/industries',
    });
  }
  return marketingMetadata({
    title: vertical.name,
    description: vertical.description,
    path: `/industries/${sector}`,
  });
}

export default async function IndustrySectorPage({ params }: Props) {
  const { sector } = await params;
  const vertical = INDUSTRY_VERTICALS.find((v) => v.id === sector);

  if (!vertical || vertical.status === 'available') {
    notFound();
  }

  return (
    <>
      <MarketingPageHeader
        eyebrow="Coming soon"
        title={vertical.name}
        description={vertical.description}
        align="center"
      />

      <MarketingPageBody narrow>
        <ul className="text-left text-sm text-pub-ink-muted">
          {vertical.features.map((f) => (
            <li key={f} className="border-b border-pub-border py-3">
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-sm text-pub-ink-subtle">
          This vertical is on the Stride roadmap. The horizontal core is available today.{' '}
          <Link href="/platform" className="font-semibold text-[var(--pub-primary)] hover:underline">
            Explore the platform →
          </Link>
        </p>
      </MarketingPageBody>

      <MarketingCtaBand
        title={`Join the ${vertical.name} waitlist`}
        description="Be first to know when this vertical launches on the Stride core."
        primary={{ href: '/contact', label: 'Join waitlist' }}
      />
    </>
  );
}
