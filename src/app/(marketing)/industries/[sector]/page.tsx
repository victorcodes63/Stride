import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INDUSTRY_VERTICALS } from '@/lib/marketing-config';
import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';

type Props = { params: Promise<{ sector: string }> };

export async function generateStaticParams() {
  return INDUSTRY_VERTICALS.filter((v) => v.status === 'coming_soon').map((v) => ({
    sector: v.id,
  }));
}

export async function generateMetadata({ params }: Props) {
  const { sector } = await params;
  const vertical = INDUSTRY_VERTICALS.find((v) => v.id === sector);
  if (!vertical) return { title: 'Industry' };
  return {
    title: vertical.name,
    description: vertical.description,
  };
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
