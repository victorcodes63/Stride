'use client';

import Link from 'next/link';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { INDUSTRY_DEEP_DIVES } from './industries-content';

export function IndustriesSectorNav() {
  return (
    <section className="border-b border-[var(--sc-line)] bg-[var(--sc-paper)] py-6 sm:py-8">
      <StudioCraftContainer>
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sc-coral)]">
            Sectors we serve
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--sc-ink-muted)] sm:text-base">
            Jump to your industry — each section covers the pain, what Stride runs, and whether it is
            Six vertical packs are live on the shared Stride core — explore each sector below.
          </p>
        </Reveal>
        <Stagger
          as="ul"
          className="mt-5 flex flex-wrap gap-2"
          delayChildren={0.06}
        >
          {INDUSTRY_DEEP_DIVES.map((industry) => (
            <StaggerItem key={industry.id} as="li">
              <Link
                href={`#${industry.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--sc-line)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--sc-ink)] transition-colors hover:border-[var(--sc-coral)]/40 hover:text-[var(--sc-coral)]"
              >
                {industry.name}
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    industry.status === 'available'
                      ? 'text-[var(--sc-coral)]'
                      : 'text-[var(--sc-ink-subtle,#8A8076)]'
                  }`}
                >
                  {industry.status === 'available' ? 'Live' : 'Roadmap'}
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}
