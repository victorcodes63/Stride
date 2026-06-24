'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { MARKETING_CTAS, MARKETING_ROUTES, getMarketingLoginUrl } from '@/lib/marketing-config';
import { isDemoAccessPageEnabled } from '@/lib/demo-access';

const ROLL_EASE = 'cubic-bezier(0.25,0.1,0.25,1)';

const FOCUS_RING_LIGHT =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const FOCUS_RING_DARK =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sc-ink)]';

function ctaArrowClass(variant: 'coral' | 'ink') {
  return `flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-500 group-hover:-rotate-45 ${
    variant === 'coral' ? 'bg-white text-[var(--sc-coral)]' : 'bg-white text-[var(--sc-ink)]'
  }`;
}

type MarketingSignInLinkProps = {
  tone?: 'light' | 'dark';
  className?: string;
  onClick?: () => void;
  fullWidth?: boolean;
};

/** Secondary pill — white fill on light surfaces, transparent on dark. */
export function MarketingOutlineLink({
  href,
  label,
  tone = 'light',
  fullWidth = false,
  showArrow = false,
  className = '',
  onClick,
}: {
  href: string;
  label: string;
  tone?: 'light' | 'dark';
  fullWidth?: boolean;
  showArrow?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const isLight = tone === 'light';

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group inline-flex min-h-11 items-center gap-2 rounded-full border py-2 text-sm font-semibold transition ${
        showArrow ? 'pl-5 pr-2' : 'justify-center px-6 py-2.5'
      } ${
        isLight
          ? `border-[var(--sc-line)] bg-white text-[var(--sc-ink)] hover:border-[var(--sc-ink)]/20 hover:bg-[var(--sc-paper-2)] ${FOCUS_RING_LIGHT}`
          : `border-white/40 bg-transparent text-[var(--sc-paper)] hover:border-white/70 hover:bg-white/[0.06] ${FOCUS_RING_DARK}`
      } ${fullWidth ? 'w-full justify-center px-5' : ''} ${className}`.trim()}
    >
      {showArrow ? (
        <>
          <span className="relative h-5 overflow-hidden">
            <RollLabel label={label} />
          </span>
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-500 group-hover:-rotate-45 ${
              isLight ? 'bg-[var(--sc-ink)] text-white' : 'bg-white text-[var(--sc-ink)]'
            }`}
            style={{ transitionTimingFunction: ROLL_EASE }}
          >
            <ArrowRight size={14} weight="bold" aria-hidden />
          </span>
        </>
      ) : (
        label
      )}
    </Link>
  );
}

/** Outlined Sign in — matches secondary pill language. */
export function MarketingSignInLink({
  tone = 'light',
  className = '',
  onClick,
  fullWidth = false,
}: MarketingSignInLinkProps) {
  return (
    <MarketingOutlineLink
      href={getMarketingLoginUrl()}
      label={MARKETING_CTAS.signIn}
      tone={tone}
      fullWidth={fullWidth}
      className={className}
      onClick={onClick}
    />
  );
}

/** Self-serve demo sandbox — only when /demo-access is enabled for this deploy. */
export function MarketingTrySandboxLink({
  tone = 'light',
  className = '',
  fullWidth = false,
}: {
  tone?: 'light' | 'dark';
  className?: string;
  fullWidth?: boolean;
}) {
  if (!isDemoAccessPageEnabled()) return null;
  return (
    <MarketingOutlineLink
      href={MARKETING_ROUTES.demoAccess}
      label={MARKETING_CTAS.trySandbox}
      tone={tone}
      fullWidth={fullWidth}
      className={className}
    />
  );
}

type MarketingPrimaryLinkProps = {
  href: string;
  label: string;
  variant?: 'coral' | 'ink';
  showArrow?: boolean;
  fullWidth?: boolean;
  className?: string;
  onClick?: () => void;
};

/** Primary pill — coral (or ink) fill, optional roll label + arrow chip. */
export function MarketingPrimaryLink({
  href,
  label,
  variant = 'coral',
  showArrow = true,
  fullWidth = false,
  className = '',
  onClick,
}: MarketingPrimaryLinkProps) {
  const isInk = variant === 'ink';

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group inline-flex min-h-11 items-center gap-2 rounded-full py-2 pl-5 pr-2 text-sm font-semibold text-white transition-colors duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        isInk
          ? 'bg-[var(--sc-ink)] hover:bg-[var(--sc-ink)]'
          : 'bg-[var(--sc-coral)] hover:bg-[var(--sc-coral-deep)]'
      } ${fullWidth ? 'w-full justify-center px-5' : ''} ${className}`.trim()}
    >
      <span className={showArrow ? 'relative h-5 overflow-hidden' : undefined}>
        {showArrow ? <RollLabel label={label} /> : label}
      </span>
      {showArrow ? (
        <span className={ctaArrowClass(isInk ? 'ink' : 'coral')} style={{ transitionTimingFunction: ROLL_EASE }}>
          <ArrowRight size={14} weight="bold" aria-hidden />
        </span>
      ) : null}
    </Link>
  );
}

type TextRollLinkProps = {
  href: string;
  label: string;
  variant?: 'ink' | 'coral';
  className?: string;
  showArrow?: boolean;
};

export function TextRollLink({
  href,
  label,
  variant = 'ink',
  className = '',
  showArrow = true,
}: TextRollLinkProps) {
  return (
    <MarketingPrimaryLink
      href={href}
      label={label}
      variant={variant}
      showArrow={showArrow}
      className={className}
    />
  );
}

type TextRollButtonProps = {
  label: string;
  onClick?: () => void;
  variant?: 'ink' | 'coral';
  className?: string;
};

export function TextRollButton({
  label,
  onClick,
  variant = 'ink',
  className = '',
}: TextRollButtonProps) {
  const isInk = variant === 'ink';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex min-h-11 items-center gap-2 rounded-full py-2 pl-5 pr-2 text-sm font-semibold text-white transition-colors duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        isInk
          ? 'bg-[var(--sc-ink)] hover:bg-[var(--sc-ink)]'
          : 'bg-[var(--sc-coral)] hover:bg-[var(--sc-coral-deep)]'
      } ${className}`.trim()}
    >
      <span className="relative h-5 overflow-hidden">
        <RollLabel label={label} />
      </span>
      <span className={ctaArrowClass(isInk ? 'ink' : 'coral')} style={{ transitionTimingFunction: ROLL_EASE }}>
        <ArrowRight size={14} weight="bold" aria-hidden />
      </span>
    </button>
  );
}

export function RollLabel({ label }: { label: string }) {
  return (
    <span className="relative h-5 overflow-hidden">
      <span className="block transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
        <span className="block leading-5">{label}</span>
        <span className="block leading-5">{label}</span>
      </span>
    </span>
  );
}

export function SectionBadge({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-3 sm:mb-8">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sc-coral)]/25 bg-[var(--sc-coral)]/10 text-sm font-medium text-[var(--sc-coral)]">
        {number}
      </span>
      <span className="rounded-full border border-[var(--sc-coral)]/15 bg-[var(--sc-coral)]/[0.06] px-3 py-1 text-[13px] font-medium text-[var(--sc-coral)]">
        {label}
      </span>
    </div>
  );
}

export function StudioCraftContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 ${className}`.trim()}>
      {children}
    </div>
  );
}
