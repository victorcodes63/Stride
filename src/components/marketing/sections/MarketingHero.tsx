'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { MARKETING_CTAS, MARKETING_ROUTES } from '@/lib/marketing-config';
import { MarketingProductShot } from '@/components/marketing/sections/MarketingProductShot';

const ease = [0.22, 1, 0.36, 1] as const;

function HeroBlock({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  delay: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

export function MarketingHero() {
  const reduceMotion = useReducedMotion();

  return (
    <header className="pub-on-ink relative overflow-hidden bg-pub-ink pb-0 pt-[160px]">
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[700px] w-[1100px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,84,54,0.18) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        aria-hidden
      />

      <div className="relative z-[2] mx-auto max-w-[920px] px-6 text-center sm:px-12">
        <HeroBlock delay={0.1}>
          <div className="mb-[30px] inline-flex rounded-full border border-[var(--pub-primary)]/25 bg-[var(--pub-primary)]/[0.08] px-3.5 py-1.5">
            <span className="text-xs font-semibold tracking-wide text-[var(--pub-primary)]">
              Operations platform · East Africa
            </span>
          </div>
        </HeroBlock>

        <HeroBlock delay={0.22}>
          <h1 className="font-heading text-[clamp(2.75rem,6.5vw,5.375rem)] font-extrabold leading-[1] tracking-[-2.5px] text-[#FBF8F4]">
            Move your business
            <br />
            <span className="bg-gradient-to-br from-[var(--pub-primary)] to-[#FF8A6E] bg-clip-text text-transparent">
              forward.
            </span>
          </h1>
        </HeroBlock>

        <HeroBlock delay={0.34}>
          <p className="mx-auto mt-[26px] max-w-[560px] text-[19px] font-light leading-relaxed text-[#F0EFE9]/70">
            <strong className="font-medium text-[#FBF8F4]">
              HR, Finance, Procurement, Legal, Projects and Admin
            </strong>{' '}
            — one platform built for East African business. M-Pesa native. Compliance first. Live from
            day one.
          </p>
        </HeroBlock>

        <HeroBlock delay={0.46}>
          <div className="mt-[38px] flex flex-wrap justify-center gap-3.5">
            <Link
              href={MARKETING_ROUTES.contact}
              className="inline-flex rounded-[10px] bg-[var(--pub-primary)] px-8 py-[15px] text-base font-semibold text-pub-ink transition hover:-translate-y-0.5 hover:bg-[var(--pub-primary-hover)] hover:shadow-[0_16px_36px_rgba(255,84,54,0.18)]"
            >
              {MARKETING_CTAS.bookDemo}
            </Link>
            <Link
              href={MARKETING_ROUTES.contact}
              className="inline-flex rounded-[10px] border border-white/[0.14] bg-white/[0.06] px-8 py-[15px] text-base font-semibold text-[#FBF8F4] transition hover:bg-white/[0.12]"
            >
              {MARKETING_CTAS.watchDemo}
            </Link>
          </div>
          <p className="mt-[18px] text-[13px] text-[#F0EFE9]/55">
            No setup fee · No lock-in · Free data migration
          </p>
        </HeroBlock>
      </div>

      <motion.div
        className="relative z-[2] mx-auto mt-[70px] max-w-[1080px] px-6 sm:px-10"
        initial={reduceMotion ? false : { opacity: 0, y: 50, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease, delay: 0.7 }}
      >
        <MarketingProductShot
          placeholderTitle="Dashboard screenshot"
          placeholderSub={
            <>
              Drop a 16:10 PNG into{' '}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-[var(--pub-primary)]">
                public/marketing/
              </code>{' '}
              when ready — recommended 1600×1000.
            </>
          }
        />
      </motion.div>
    </header>
  );
}
