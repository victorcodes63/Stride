import Link from 'next/link';
import { StrideMark } from '@/components/marketing/StrideMark';

type CareersDemoBannerProps = {
  employerName: string;
};

/** Shown on `/careers` in demo deployments — clarifies this is a sample tenant portal. */
export function CareersDemoBanner({ employerName }: CareersDemoBannerProps) {
  return (
    <div
      className="sticky top-[68px] z-40 border-b border-[var(--pub-primary)]/25 bg-pub-ink/95 backdrop-blur-sm"
      role="note"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 text-center sm:justify-between sm:px-8 sm:text-left">
        <p className="inline-flex flex-wrap items-center justify-center gap-2 text-sm text-[#C9C0B6] sm:justify-start">
          <StrideMark className="h-3.5 shrink-0" variant="coral" />
          <span>
            <strong className="font-semibold text-white">Sample careers portal</strong>
            {' — '}
            powered by Stride recruitment. Employer branding ({employerName}) is configurable per
            client.
          </span>
        </p>
        <Link
          href="/platform"
          className="shrink-0 text-sm font-semibold text-[var(--pub-primary)] transition hover:text-white"
        >
          How recruitment works →
        </Link>
      </div>
    </div>
  );
}
