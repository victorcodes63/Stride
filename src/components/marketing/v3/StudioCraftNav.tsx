'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { List, X } from '@phosphor-icons/react';
import { StrideLogo } from '@/components/marketing/StrideMark';
import {
  MARKETING_CTAS,
  MARKETING_NAV_LINKS,
  MARKETING_ROUTES,
  getMarketingLoginUrl,
} from '@/lib/marketing-config';
import { MarketingPrimaryLink, MarketingSignInLink, StudioCraftContainer, TextRollLink } from './studio-craft-shared';
import { studioCraftBrandVars } from './StudioCraftShell';

export function StudioCraftNav({ overHero = false }: { overHero?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** Light-on-dark only while floating over the homepage's ink hero. */
  const onDark = overHero && !scrolled && !menuOpen;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    document.body.classList.toggle('marketing-menu-open', menuOpen);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('marketing-menu-open');
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const mobileMenu =
    mounted && menuOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col bg-[#FBF8F4] text-[#1A1714] md:hidden"
            style={studioCraftBrandVars}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#E6DED4] bg-[#FBF8F4] px-5 pb-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6">
              <Link
                href={MARKETING_ROUTES.home}
                className="flex items-center"
                aria-label="Stride home"
                onClick={closeMenu}
              >
                <StrideLogo heightClass="h-6" />
              </Link>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--sc-line)] bg-white text-[var(--sc-ink)]"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-6 sm:px-6" aria-label="Mobile">
              <ul className="space-y-1">
                {MARKETING_NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-xl px-2 py-3 text-[1.75rem] font-medium leading-tight tracking-[-0.02em] text-[#1A1714] transition-colors hover:bg-[#F4EFE8] sm:text-[2rem]"
                      onClick={closeMenu}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="marketing-mobile-drawer-cta shrink-0 space-y-3 border-t border-[#E6DED4] bg-[#FBF8F4] px-5 py-5 sm:px-6">
              <MarketingPrimaryLink
                href={MARKETING_ROUTES.contact}
                label={MARKETING_CTAS.bookDemo}
                variant="coral"
                fullWidth
                showArrow
                onClick={closeMenu}
              />
              <MarketingSignInLink fullWidth className="py-2.5 text-[15px]" onClick={closeMenu} />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <nav
        className={`relative z-20 transition-[background-color,border-color,box-shadow] duration-300 ${
          onDark
            ? 'border-b border-transparent bg-transparent'
            : 'border-b border-[var(--sc-line)] bg-[#FBF8F4]/95 shadow-[0_1px_0_rgba(26,23,20,0.02)] backdrop-blur-md'
        }`}
        aria-hidden={menuOpen}
      >
        <StudioCraftContainer>
          <div className="flex h-[var(--nav-h)] items-center justify-between gap-6">
            <Link
              href={MARKETING_ROUTES.home}
              className="flex shrink-0 items-center"
              aria-label="Stride home"
              tabIndex={menuOpen ? -1 : 0}
            >
              <StrideLogo heightClass="h-6 sm:h-7" />
            </Link>

            <div className="hidden items-center gap-9 md:flex" role="navigation" aria-label="Primary">
              {MARKETING_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[15px] font-medium transition-colors duration-200 ${
                    onDark
                      ? 'text-[#FBF8F4]/80 hover:text-[#FBF8F4]'
                      : 'text-[var(--sc-ink)]/80 hover:text-[var(--sc-ink)]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <Link
                href={getMarketingLoginUrl()}
                className={`px-3 py-2 text-[15px] font-medium transition-colors ${
                  onDark ? 'text-[#FBF8F4]/85 hover:text-[#FBF8F4]' : 'text-[var(--sc-ink)]/80 hover:text-[var(--sc-ink)]'
                }`}
              >
                {MARKETING_CTAS.signIn}
              </Link>
              <TextRollLink
                href={MARKETING_ROUTES.contact}
                label={MARKETING_CTAS.bookDemo}
                variant="coral"
              />
            </div>

            <button
              type="button"
              className={`flex h-10 w-10 items-center justify-center rounded-full md:hidden ${
                onDark ? 'bg-white/10 text-white' : 'bg-[var(--sc-ink)] text-white'
              }`}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
            </button>
          </div>
        </StudioCraftContainer>
      </nav>

      {mobileMenu}
    </>
  );
}
