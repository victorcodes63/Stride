'use client';

import { Briefcase, CalendarCheck, ClipboardText, Funnel, Kanban, PaintBrushBroad } from '@phosphor-icons/react';
import { PubFeatureCallout } from '@/components/public/PubDuotoneIcon';

const CANDIDATE_HIGHLIGHTS = [
  {
    icon: Briefcase,
    title: 'Open roles only',
    description: 'Every listing is an active vacancy with department, location, and type.',
  },
  {
    icon: CalendarCheck,
    title: 'Clear deadlines',
    description: 'Closing dates are shown upfront so candidates know when to apply.',
  },
  {
    icon: ClipboardText,
    title: 'Structured hiring',
    description: 'Applications follow a consistent screening and interview workflow.',
  },
] as const;

const PRODUCT_DEMO_HIGHLIGHTS = [
  {
    icon: Funnel,
    title: 'Structured applications',
    description:
      'Custom application forms, screening questions, and résumé capture — no third-party ATS bolt-on.',
  },
  {
    icon: Kanban,
    title: 'Pipeline & interviews',
    description:
      'Move candidates through stages, schedule interviews, and track feedback from one recruiter dashboard.',
  },
  {
    icon: PaintBrushBroad,
    title: 'Your brand, your jobs',
    description:
      'Employer name, tagline, hero image, and listings are configured in Company setup — same platform as payroll and HR.',
  },
] as const;

export type CareersHighlightsVariant = 'candidate' | 'product-demo';

type CareersHighlightsProps = {
  variant?: CareersHighlightsVariant;
};

export default function CareersHighlights({ variant = 'candidate' }: CareersHighlightsProps) {
  const isProductDemo = variant === 'product-demo';
  const items = isProductDemo ? PRODUCT_DEMO_HIGHLIGHTS : CANDIDATE_HIGHLIGHTS;

  return (
    <section className="border-b border-pub-border bg-pub-surface py-12 md:py-14">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        {isProductDemo ? (
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pub-primary)]">
              For HR & recruitment teams
            </p>
            <h2 className="mt-2 font-heading text-xl font-bold tracking-tight text-pub-ink md:text-2xl">
              What this demo shows
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-pub-ink-muted">
              Try the candidate journey below, then sign in to the recruiter dashboard to see
              applications, screening, and interview scheduling on the same Stride core.
            </p>
          </div>
        ) : null}
        <ul className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {items.map((item) => (
            <li key={item.title}>
              <PubFeatureCallout {...item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
