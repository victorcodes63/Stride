import { PRICING_TIERS } from '@/lib/marketing-config';
import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import {
  MarketingOutlineLink,
  MarketingPrimaryLink,
} from '@/components/marketing/v3/studio-craft-shared';

export const metadata = {
  title: 'Pricing',
  description: 'Stride platform pricing — size-banded tiers in KES, not per-seat.',
};

export default function PricingPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Pricing"
        title="Simple tiers. Kenyan shillings."
        description="Platform access banded by organisation size. Add vertical packs when you need them. No per-seat surprises."
        align="center"
      />

      <MarketingPageBody>
        <div className="grid gap-5 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.id}
              className={`flex flex-col rounded-[20px] border p-5 text-center sm:p-8 ${
                tier.featured ? 'pub-on-ink border-pub-ink bg-pub-ink text-[#FBF8F4]' : 'border-pub-border bg-white'
              }`}
            >
              {tier.featured ? (
                <span className="mx-auto mb-4 inline-flex rounded-full bg-[var(--pub-primary)]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--pub-primary)]">
                  Most popular
                </span>
              ) : null}
              <p className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--pub-primary)]">
                {tier.name}
              </p>
              <p
                className={`mt-3 font-heading text-[clamp(1.75rem,8vw,2.25rem)] font-extrabold sm:mt-4 sm:text-4xl ${
                  tier.featured ? '' : 'text-pub-ink'
                }`}
              >
                {tier.price}
              </p>
              <p className={`text-sm ${tier.featured ? 'text-[#9C948A]' : 'text-pub-ink-subtle'}`}>
                {tier.unit}
              </p>
              <p
                className={`my-6 border-b pb-6 text-sm leading-relaxed ${
                  tier.featured
                    ? 'border-white/10 text-[#C9C0B6]'
                    : 'border-pub-border text-pub-ink-muted'
                }`}
              >
                {tier.description}
              </p>
              <ul
                className={`mx-auto mb-8 flex w-full max-w-[16rem] flex-1 flex-col gap-3 text-left text-sm sm:max-w-[18rem] ${
                  tier.featured ? 'text-[#D8D2C9]' : 'text-pub-ink-muted'
                }`}
              >
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-[var(--pub-primary)]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {tier.featured ? (
                <MarketingPrimaryLink
                  href="/contact"
                  label={tier.cta}
                  variant="coral"
                  showArrow
                  fullWidth
                />
              ) : (
                <MarketingOutlineLink href="/contact" label={tier.cta} showArrow fullWidth />
              )}
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-pub-ink-subtle">
          All plans include data migration support.
        </p>
      </MarketingPageBody>

      <MarketingCtaBand
        title="Not sure which tier fits?"
        description="Tell us your team size and modules — we will recommend a plan."
        primary={{ href: '/contact', label: 'Talk to us' }}
        variant="coral"
      />
    </>
  );
}
