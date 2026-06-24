'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { StrideLogo } from '@/components/marketing/StrideMark';
import { MarketingCloseButton } from '@/components/marketing/MarketingCloseButton';
import { brandConfig } from '@/lib/brand.config';
import { getMarketingSiteUrl } from '@/lib/marketing-config';
import { usePublicBrand } from '@/components/BrandProvider';
import '@/components/marketing/contact/book-demo.css';

type AuthSplitShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthSplitShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthSplitShellProps) {
  const { privacyPolicyUrl, termsUrl } = usePublicBrand();
  const year = new Date().getFullYear();
  const marketingHome = getMarketingSiteUrl();

  return (
    <main className="flex min-h-[100dvh] w-full max-w-[100vw] flex-col gap-2 overflow-x-clip bg-[var(--sc-ink)] p-2 selection:bg-[var(--sc-coral)]/25 sm:gap-3 sm:p-3 lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden lg:p-4">
      <section className="bd-demo-panel pub-on-ink relative flex min-h-[min(320px,42vh)] flex-col overflow-hidden rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-[28px] lg:min-h-0">
        <div
          className="pointer-events-none absolute -right-[10%] top-[5%] h-[55%] w-[55%] rounded-full opacity-30 blur-[80px] bd-demo-drift-a"
          style={{ background: 'radial-gradient(circle, var(--sc-coral) 0%, transparent 68%)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-[8%] bottom-[10%] h-[45%] w-[45%] rounded-full opacity-20 blur-[70px] bd-demo-drift-b"
          style={{ background: 'radial-gradient(circle, var(--sc-coral-deep) 0%, transparent 70%)' }}
          aria-hidden
        />

        <Link
          href={marketingHome}
          className="relative z-10 p-8 pb-0 xl:p-10 xl:pb-0"
          aria-label="Stride home"
        >
          <StrideLogo heightClass="h-7 sm:h-8" className="brightness-0 invert" />
        </Link>

        <div className="bd-demo-copy relative z-10 flex flex-1 flex-col justify-end p-8 pt-10 xl:p-10 xl:pb-12">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sc-coral)]">
              {eyebrow}
            </p>
            <h1 className="max-w-[22rem] text-[clamp(1.75rem,3.5vw,2.375rem)] font-normal leading-[1.08] tracking-tight !text-[#fbf8f4]">
              {title}
            </h1>
            <p className="max-w-[30ch] text-[14px] leading-relaxed text-[#fbf8f4]/82">{subtitle}</p>
          </div>

          <footer className="bd-demo-tagline mt-10 hidden lg:block">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em]" suppressHydrationWarning>
              © {year} {brandConfig.productName}
            </p>
            <nav className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#fbf8f4]/50">
              <Link href="/careers" className="transition-colors hover:text-[#fbf8f4]">
                Careers
              </Link>
              <Link href={privacyPolicyUrl || '/privacy'} className="transition-colors hover:text-[#fbf8f4]">
                Privacy
              </Link>
              <Link href={termsUrl || '/terms'} className="transition-colors hover:text-[#fbf8f4]">
                Terms
              </Link>
            </nav>
          </footer>
        </div>
      </section>

      <section className="relative flex min-h-0 flex-col overflow-y-auto rounded-[20px] bg-[var(--sc-ink)] sm:rounded-[28px] lg:overflow-hidden">
        <MarketingCloseButton label="Back to Stride homepage" />

        <div className="auth-studio-form bd-demo-form relative z-0 flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center px-5 py-14 sm:px-10 lg:px-14 lg:py-10 xl:px-20">
            <div className="w-full max-w-md">{children}</div>
          </div>
          {footer}
        </div>
      </section>
    </main>
  );
}

export function LoginCard({
  children,
  footer,
  className = '',
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full space-y-6 ${className}`.trim()}>
      {children}
      {footer ? (
        <div className="border-t border-white/10 pt-4 text-[0.8125rem] text-[#fbf8f4]/55">{footer}</div>
      ) : null}
    </div>
  );
}
