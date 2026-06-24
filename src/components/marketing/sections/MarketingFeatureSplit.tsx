import Link from 'next/link';
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow';
import { MarketingReveal } from '@/components/marketing/MarketingReveal';
import { MarketingProductShot } from '@/components/marketing/sections/MarketingProductShot';
import { marketingAppHostLabel } from '@/lib/marketing-config';

export function MarketingFeatureSplit() {
  return (
    <section className="bg-pub-surface-muted px-6 py-[80px] sm:px-10 lg:py-[120px]">
      <div className="mx-auto grid max-w-[1120px] items-center gap-16 lg:grid-cols-2 lg:gap-16">
        <div>
          <MarketingReveal>
            <MarketingEyebrow>One source of truth</MarketingEyebrow>
          </MarketingReveal>
          <MarketingReveal delay={0.08}>
            <h2 className="font-heading text-[clamp(1.875rem,4vw,3.125rem)] font-extrabold leading-[1.06] tracking-[-1.5px] text-pub-ink">
              Every module,
              <br />
              one login.
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={0.16}>
            <p className="mt-[18px] max-w-[540px] text-[17px] leading-relaxed text-pub-ink-muted">
              No more juggling spreadsheets, WhatsApp approvals and disconnected tools. Stride brings
              your whole operation into one place — so your team stops switching context and starts
              moving.
            </p>
            <Link
              href="/platform"
              className="mt-6 inline-block text-sm font-semibold text-[var(--pub-primary)] transition hover:text-[var(--pub-primary-hover)]"
            >
              Explore the platform →
            </Link>
          </MarketingReveal>
        </div>
        <MarketingReveal delay={0.12}>
          <MarketingProductShot
            aspectClassName="aspect-[4/3]"
            browserUrl={marketingAppHostLabel('/payroll')}
            placeholderTitle="Feature screenshot"
            placeholderSub="A focused module view (e.g. payroll run or approvals). 4:3 PNG."
            className="overflow-hidden rounded-[14px] border border-pub-border shadow-[0_30px_70px_-25px_rgba(26,23,20,0.3)]"
          />
        </MarketingReveal>
      </div>
    </section>
  );
}
