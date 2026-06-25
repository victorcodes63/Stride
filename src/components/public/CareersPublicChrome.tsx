import Link from 'next/link';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';
import { getMarketingHomeUrl } from '@/lib/marketing-config';

/** Minimal app-side careers header — Stride product chrome, not marketing nav. */
export default function CareersPublicChrome() {
  const home = getMarketingHomeUrl();

  return (
    <header className="sticky top-0 z-50 border-b border-pub-border bg-pub-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href={home} aria-label="Stride home">
          <StrideWordmarkLockup theme="on-light" markClassName="h-6" wordClassName="text-lg" />
        </Link>
        <nav aria-label="Careers" className="flex items-center gap-4">
          <Link
            href="/careers"
            className="text-sm font-semibold text-pub-ink-muted transition hover:text-pub-ink"
          >
            Open roles
          </Link>
          <Link href="/dashboard/login" className="pub-btn-primary pub-btn-primary--sm">
            Staff sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
