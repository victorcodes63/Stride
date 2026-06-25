import { isDemoAccessPageEnabled } from '@/lib/demo-access';
import { MARKETING_CTAS, MARKETING_ROUTES } from '@/lib/marketing-config';
import {
  MarketingPrimaryLink,
  MarketingSignInLink,
  MarketingTrySandboxLink,
  StudioCraftContainer,
} from '@/components/marketing/v3/studio-craft-shared';

export function MarketingFinalCta() {
  const demoAccessEnabled = isDemoAccessPageEnabled();

  return (
    <section className="pub-on-ink sc-on-ink relative overflow-hidden bg-[var(--sc-ink)] py-16 text-center text-[#FBF8F4] sm:py-24 lg:py-32">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(--sc-coral) 22%, transparent) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <StudioCraftContainer className="relative z-[1]">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--sc-coral)]/[0.12] px-3 py-1 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--sc-coral)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
          Get started
        </p>
        <h2 className="!text-[#FBF8F4] text-[clamp(1.875rem,7vw,4rem)] font-medium leading-[1.05] tracking-[-0.03em] sm:leading-[1.02]">
          Ready to
          <br />
          hit your <span className="text-[var(--sc-coral)]">stride?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#FBF8F4]/70 sm:mt-5 sm:text-base lg:text-lg">
          No setup fee. No lock-in. Local support from day one.
          <span className="hidden sm:inline">
            <br />
          </span>{' '}
          <span className="sm:block">Your whole business, finally moving as one.</span>
        </p>
        <div className="marketing-cta-stack mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <MarketingPrimaryLink
            href={MARKETING_ROUTES.contact}
            label={MARKETING_CTAS.bookDemo}
            variant="coral"
            fullWidth
            className="sm:w-auto"
          />
          <MarketingTrySandboxLink enabled={demoAccessEnabled} tone="dark" className="w-full sm:w-auto" />
          <MarketingSignInLink tone="dark" className="w-full sm:w-auto" />
        </div>
      </StudioCraftContainer>
    </section>
  );
}
