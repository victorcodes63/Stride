'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { CalendarCheck, ChartLineUp, LockKey, UsersThree } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { StrideLogo } from '@/components/marketing/StrideMark';
import { MarketingCloseButton } from '@/components/marketing/MarketingCloseButton';
import { brandConfig } from '@/lib/brand.config';
import { getMarketingHomeUrl, getMarketingPageUrl, getAppPageUrl } from '@/lib/marketing-config';
import { usePublicBrand } from '@/components/BrandProvider';
import type { OAuthAudience } from '@/lib/oauth-utils';
import '@/components/marketing/contact/book-demo.css';

type AuthSplitShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  audience?: OAuthAudience;
  children: ReactNode;
  footer?: ReactNode;
};

const STAFF_POINTS: readonly { icon: Icon; title: string; detail: string }[] = [
  {
    icon: UsersThree,
    title: 'People & payroll',
    detail: 'Employees, leave, attendance and payslips on one record.',
  },
  {
    icon: ChartLineUp,
    title: 'Kenya compliance built in',
    detail: 'PAYE, NSSF, SHIF and Housing Levy on every run.',
  },
  {
    icon: LockKey,
    title: 'Secure by design',
    detail: 'Role-based access with optional SSO and MFA.',
  },
];

const ESS_POINTS: readonly { icon: Icon; title: string; detail: string }[] = [
  {
    icon: UsersThree,
    title: 'Self-service',
    detail: 'Leave, payslips, attendance and profile in one place.',
  },
  {
    icon: CalendarCheck,
    title: 'Requests & approvals',
    detail: 'Submit leave and track status without chasing HR.',
  },
  {
    icon: LockKey,
    title: 'Secure access',
    detail: 'Sign in with your work account or organisation SSO.',
  },
];

function BrandPoint({
  icon: IconCmp,
  title,
  detail,
}: {
  icon: Icon;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sc-coral)] text-white shadow-[0_8px_20px_-6px_rgba(255,84,54,0.85)]">
        <IconCmp className="h-3.5 w-3.5" weight="bold" aria-hidden />
      </span>
      <p className="min-w-0 truncate text-[14px] leading-snug text-[var(--sc-ink)]">
        <span className="font-semibold">{title}</span>
        <span className="text-[var(--sc-ink-muted)]"> — {detail}</span>
      </p>
    </div>
  );
}

/**
 * Staff / ESS login shell — white-dominant with coral accents (same language as Book a demo).
 */
export function AuthSplitShell({
  eyebrow,
  title,
  subtitle,
  audience = 'staff',
  children,
  footer,
}: AuthSplitShellProps) {
  const { privacyPolicyUrl, termsUrl } = usePublicBrand();
  const year = new Date().getFullYear();
  const marketingHome = getMarketingHomeUrl();
  const points = audience === 'ess' ? ESS_POINTS : STAFF_POINTS;

  return (
    <main className="bd-demo-shell flex min-h-[100dvh] w-full max-w-[100vw] flex-col gap-2 overflow-x-clip bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-[max(0.5rem,env(safe-area-inset-top,0px))] selection:bg-[var(--sc-coral)]/20 sm:gap-3 sm:p-3 lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden lg:bg-[var(--sc-paper-2)] lg:p-4">
      <section className="bd-demo-panel relative flex min-h-[min(300px,42vh)] flex-col overflow-hidden rounded-[20px] shadow-[0_18px_50px_-28px_rgba(26,23,20,0.28)] sm:rounded-[28px] lg:min-h-0">
        <div
          className="pointer-events-none absolute -right-[10%] top-[5%] h-[55%] w-[55%] rounded-full opacity-55 blur-[80px] bd-demo-drift-a"
          style={{ background: 'radial-gradient(circle, var(--sc-coral) 0%, transparent 68%)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-[8%] bottom-[10%] h-[45%] w-[45%] rounded-full opacity-40 blur-[70px] bd-demo-drift-b"
          style={{ background: 'radial-gradient(circle, var(--sc-coral-deep) 0%, transparent 70%)' }}
          aria-hidden
        />

        <Link
          href={marketingHome}
          className="relative z-10 p-8 pb-0 xl:p-10 xl:pb-0"
          aria-label="Stride home"
        >
          <StrideLogo heightClass="h-7 sm:h-8" />
        </Link>

        <div className="bd-demo-copy relative z-10 flex flex-1 flex-col p-8 pt-8 xl:p-10 xl:pt-10 xl:pb-12">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sc-coral)]">
              {eyebrow}
            </p>
            <h1 className="max-w-[22rem] text-[clamp(1.75rem,3.5vw,2.375rem)] font-normal leading-[1.08] tracking-tight text-[var(--sc-ink)]">
              {title}
            </h1>
            <p className="max-w-[34ch] text-[14px] leading-relaxed text-[var(--sc-ink-muted)]">
              {subtitle}
            </p>
          </div>

          <div className="bd-demo-steps mt-8 hidden max-w-[26rem] flex-1 flex-col justify-center space-y-1 lg:flex">
            {points.map((point) => (
              <BrandPoint
                key={point.title}
                icon={point.icon}
                title={point.title}
                detail={point.detail}
              />
            ))}
          </div>

          <p className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-[var(--sc-coral)]/10 px-3.5 py-1.5 text-[12px] font-medium text-[var(--sc-coral)] lg:mt-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--sc-coral)]" aria-hidden />
            Built for East African HR & payroll
          </p>

          <footer className="bd-demo-tagline mt-6 hidden lg:block">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em]" suppressHydrationWarning>
              © {year} {brandConfig.productName}
            </p>
            <nav className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--sc-ink-muted)]">
              <Link
                href={getAppPageUrl('/careers')}
                className="transition-colors hover:text-[var(--sc-ink)]"
              >
                Careers
              </Link>
              <Link
                href={getMarketingPageUrl(privacyPolicyUrl || '/privacy')}
                className="transition-colors hover:text-[var(--sc-ink)]"
              >
                Privacy
              </Link>
              <Link
                href={getMarketingPageUrl(termsUrl || '/terms')}
                className="transition-colors hover:text-[var(--sc-ink)]"
              >
                Terms
              </Link>
            </nav>
          </footer>
        </div>
      </section>

      <section className="bd-demo-form-column relative flex min-h-0 flex-col overflow-y-auto rounded-[20px] bg-white sm:rounded-[28px] lg:overflow-hidden lg:border lg:border-[var(--sc-line)] lg:shadow-[0_18px_50px_-28px_rgba(26,23,20,0.22)]">
        <MarketingCloseButton tone="light" label="Back to Stride homepage" />

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
        <div className="border-t border-[var(--sc-line)] pt-4 text-[0.8125rem] text-[var(--sc-ink-muted)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
