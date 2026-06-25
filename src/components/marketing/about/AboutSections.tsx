'use client';

import Link from 'next/link';
import type { Icon } from '@phosphor-icons/react';
import {
  DownloadSimple,
  ListChecks,
  LockSimple,
  ShieldCheck,
} from '@phosphor-icons/react';
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import {
  ABOUT_ORIGIN,
  ABOUT_PAGE,
  ABOUT_PRINCIPLES,
  ABOUT_TRUST,
  MARKETING_ROUTES,
} from '@/lib/marketing-config';

const TRUST_ICONS: Record<(typeof ABOUT_TRUST.items)[number]['icon'], Icon> = {
  'shield-check': ShieldCheck,
  lock: LockSimple,
  download: DownloadSimple,
  'list-checks': ListChecks,
};

function StatValue({ value }: { value: string }) {
  const numericMatch = value.match(/^(\d+)(.*)$/);

  if (numericMatch) {
    const num = Number.parseInt(numericMatch[1], 10);
    const suffix = numericMatch[2] ?? '';
    return (
      <CountUp
        value={num}
        suffix={suffix}
        className="text-[clamp(2rem,4.5vw,3rem)] font-medium leading-none tracking-[-0.03em] text-[var(--sc-coral)]"
      />
    );
  }

  return (
    <span className="text-[clamp(2rem,4.5vw,3rem)] font-medium leading-none tracking-[-0.03em] text-[var(--sc-coral)]">
      {value}
    </span>
  );
}

function TrustIconChip({ icon: IconComponent }: { icon: Icon }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--sc-line)] bg-[var(--sc-paper-2)] text-[var(--sc-ink)]">
      <IconComponent size={18} weight="regular" aria-hidden />
    </span>
  );
}

export function AboutOriginSection() {
  return (
    <section className="border-y border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-12 sm:py-20 lg:py-24">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="01" label={ABOUT_ORIGIN.badge} />
        </Reveal>

        <Reveal delay={0.06}>
          <h2 className="max-w-[720px] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
            {ABOUT_ORIGIN.heading}
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-8 max-w-[52ch] text-[clamp(1.25rem,2.5vw,2rem)] font-medium leading-[1.35] tracking-[-0.02em] text-[var(--sc-ink)]">
            {ABOUT_ORIGIN.lead}
          </p>
        </Reveal>

        <Stagger className="mt-10 max-w-[62ch] space-y-6" delayChildren={0.14}>
          {ABOUT_ORIGIN.paragraphs.map((paragraph) => (
            <StaggerItem key={'emphasis' in paragraph ? paragraph.emphasis : paragraph.text.slice(0, 40)}>
              <div className="border-l-2 border-[var(--sc-coral)] pl-6 sm:pl-8">
                <p className="text-base leading-[1.75] text-[var(--sc-ink-muted)] sm:text-[17px]">
                  {'emphasis' in paragraph ? (
                    <>
                      {paragraph.text}
                      <strong className="font-medium text-[var(--sc-ink)]">{paragraph.emphasis}</strong>
                      {paragraph.textAfter}
                    </>
                  ) : (
                    paragraph.text
                  )}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}

export function AboutPrinciplesSection() {
  const { principles } = ABOUT_PAGE;

  return (
    <section className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="02" label={principles.badge} />
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="max-w-[680px] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
            {principles.title}
          </h2>
        </Reveal>

        <Stagger className="mt-12 grid gap-5 md:grid-cols-3" delayChildren={0.12}>
          {ABOUT_PRINCIPLES.map((item, i) => (
            <StaggerItem
              key={item.title}
              as="article"
              className="flex h-full flex-col rounded-2xl border border-[var(--sc-line)] border-t-[var(--sc-coral)]/35 bg-[var(--sc-paper-2)] px-7 pb-8 pt-7 sm:px-8 sm:pb-9 sm:pt-8"
            >
              <span className="font-mono text-[13px] font-semibold tracking-[0.08em] text-[var(--sc-coral)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-5 text-lg font-medium tracking-tight text-[var(--sc-ink)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--sc-ink-muted)]">{item.body}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.16} className="mt-12">
          <p className="text-sm text-[var(--sc-ink-muted)]">
            <Link href={MARKETING_ROUTES.platform} className="font-medium text-[var(--sc-coral)] hover:underline">
              Explore the platform →
            </Link>
          </p>
        </Reveal>
      </StudioCraftContainer>
    </section>
  );
}

export function AboutTrustSection() {
  return (
    <section className="border-y border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-16 sm:py-20 lg:py-24">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="03" label={ABOUT_TRUST.badge} />
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="max-w-[640px] text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
            {ABOUT_TRUST.heading}
          </h2>
        </Reveal>

        <Stagger
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
          delayChildren={0.12}
        >
          {ABOUT_TRUST.items.map((item) => {
            const IconComponent = TRUST_ICONS[item.icon];
            return (
              <StaggerItem
                key={item.id}
                as="article"
                className="flex h-full flex-col rounded-2xl border border-[var(--sc-line)] bg-[var(--sc-paper-2)] p-6"
              >
                <TrustIconChip icon={IconComponent} />
                <h3 className="mt-5 text-base font-medium tracking-tight text-[var(--sc-ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--sc-ink-muted)]">{item.body}</p>
              </StaggerItem>
            );
          })}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}

export function AboutStatsBand() {
  return (
    <section className="sc-on-ink bg-[var(--sc-ink)] py-14 text-[var(--sc-on-ink-fg-muted)] sm:py-16 lg:py-20">
      <StudioCraftContainer>
        <Stagger
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
          delayChildren={0.08}
        >
          {ABOUT_PAGE.stats.map((stat) => (
            <StaggerItem key={stat.label} className="border-t border-white/10 pt-5">
              <StatValue value={stat.value} />
              <p className="mt-3 text-sm leading-relaxed text-[var(--sc-on-ink-fg-subtle)]">{stat.label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}
