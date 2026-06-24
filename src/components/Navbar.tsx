'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, ArrowRight } from 'lucide-react';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';

const aboutLinks = [
  { name: 'Careers', href: '/careers' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' },
];

const navLinks = [{ name: 'Careers', href: '/careers' }];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'border-b border-white/10 bg-pub-ink/98 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl'
          : 'border-b border-white/5 bg-pub-ink backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href="/careers" className="inline-flex" aria-label="Stride careers">
          <StrideWordmarkLockup theme="on-ink" markClassName="h-[26px]" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setAboutOpen(true)}
            onMouseLeave={() => setAboutOpen(false)}
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-3 py-2 text-[0.9375rem] font-medium text-[#C9C0B6] transition-colors hover:text-white"
            >
              Company
              <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
            </button>
            {aboutOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-white/10 bg-pub-ink p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                {aboutLinks.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block rounded-md px-3 py-2 text-sm text-[#C9C0B6] transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {navLinks.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="rounded px-3 py-2 text-[0.9375rem] font-medium text-[#C9C0B6] transition-colors hover:text-white"
            >
              {item.name}
            </Link>
          ))}

          <Link
            href="/dashboard/login"
            className="ml-3 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--pub-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--pub-primary-hover)]"
          >
            Sign in
            <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex rounded-md p-2 text-[#C9C0B6] hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-pub-ink px-5 py-4 lg:hidden">
          <div className="space-y-1">
            {aboutLinks.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-[#C9C0B6] hover:bg-white/5 hover:text-white"
              >
                {item.name}
              </Link>
            ))}
            {navLinks.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-[#C9C0B6] hover:bg-white/5 hover:text-white"
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/dashboard/login"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--pub-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--pub-primary-hover)]"
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
