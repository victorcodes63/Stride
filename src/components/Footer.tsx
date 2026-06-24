'use client';

import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';
import { usePublicBrand } from '@/components/BrandProvider';

const Footer = () => {
  const { orgName, tagline, contactPhone, contactEmail, contactAddress, publicFooterText } =
    usePublicBrand();
  const productLinks = [
    { name: 'Open roles', href: '/careers' },
    { name: 'Staff sign in', href: '/dashboard/login' },
    { name: 'Employee portal', href: '/ess/login' },
  ];

  const legalLinks = [
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
  ];

  return (
    <footer className="relative border-t border-white/10 bg-pub-ink">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/careers" className="mb-5 inline-flex">
              <StrideWordmarkLockup theme="on-ink" markClassName="h-8" wordClassName="text-2xl" />
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-[#C9C0B6]">
              {publicFooterText?.trim() || tagline}
            </p>
            <p className="mt-3 text-sm font-medium text-white/80">{orgName}</p>
            <div className="mt-5 space-y-2 text-sm text-[#8A8076]">
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="block hover:text-primary-500">
                  {contactEmail}
                </a>
              ) : null}
              {contactPhone ? <span className="block">{contactPhone}</span> : null}
              {contactAddress ? <span className="block">{contactAddress}</span> : null}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-[#8A8076]">
              Product
            </h4>
            <ul className="space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#C9C0B6] transition-colors hover:text-primary-500"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-[#8A8076]">
              {orgName}
            </h4>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#C9C0B6] transition-colors hover:text-primary-500"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-[#8A8076]">
            © {new Date().getFullYear()} Stride · {orgName}
          </p>
          <div className="flex items-center gap-6">
            {legalLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm text-[#8A8076] transition-colors hover:text-primary-500"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-pub-ink text-[#C9C0B6] shadow-lg transition-all hover:border-primary-500 hover:text-primary-500 md:flex"
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </footer>
  );
};

export default Footer;
