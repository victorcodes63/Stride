'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MARKETING_CTAS, MARKETING_ROUTES } from '@/lib/marketing-config';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';

const NAV_LINKS = [
  { href: '/#core', label: 'Platform' },
  { href: '/#industries', label: 'Industries' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/careers', label: 'Careers' },
  { href: '/#faq', label: 'FAQ' },
] as const;

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[100] h-[68px] border-b transition-colors duration-300 ${
        scrolled
          ? 'border-white/[0.08] bg-pub-ink/[0.85] backdrop-blur-[18px] backdrop-saturate-[1.4]'
          : 'border-white/[0.06] bg-pub-ink/60 backdrop-blur-[18px] backdrop-saturate-[1.4]'
      }`}
    >
      <div className="relative mx-auto flex h-full max-w-[1120px] items-center px-6 sm:px-10">
        <Link href="/" className="shrink-0" aria-label="Stride home">
          <StrideWordmarkLockup theme="on-ink" markClassName="h-6" wordClassName="text-[22px]" />
        </Link>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-[30px] lg:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#F0EFE9]/65 transition-colors hover:text-pub-surface"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href={MARKETING_ROUTES.login}
            className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-pub-surface/80 transition hover:text-pub-surface sm:inline-flex"
          >
            {MARKETING_CTAS.signIn}
          </Link>
          <Link
            href={MARKETING_ROUTES.contact}
            className="inline-flex rounded-lg bg-pub-surface px-[18px] py-2 text-sm font-semibold text-pub-ink transition hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
          >
            {MARKETING_CTAS.bookDemo}
          </Link>
        </div>
      </div>
    </header>
  );
}
