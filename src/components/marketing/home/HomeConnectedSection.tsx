'use client';

import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { PLATFORM_PAGE, PLATFORM_WORKFLOWS } from '@/lib/marketing-config';

export function HomeConnectedSection() {
  const { connected } = PLATFORM_PAGE;

  return (
    <section className="sc-on-ink bg-[var(--sc-ink)] py-16 text-[var(--sc-paper)] sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="3" label={connected.badge} />
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="max-w-[720px] text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-paper)]">
            <span className="block">Modules that actually</span>
            <span className="block text-[var(--sc-coral)]">talk to each other.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-[640px] text-base leading-relaxed text-[var(--sc-paper)]/70">
            {connected.body}
          </p>
        </Reveal>

        <Stagger className="mt-12 grid gap-5 lg:grid-cols-3" delayChildren={0.14}>
          {PLATFORM_WORKFLOWS.map((workflow) => (
            <StaggerItem
              key={workflow.title}
              as="article"
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
            >
              <h3 className="text-lg font-medium text-[var(--sc-paper)]">{workflow.title}</h3>
              <p className="mt-3 break-words font-mono text-[10px] uppercase leading-relaxed tracking-[0.06em] text-[var(--sc-coral)] sm:text-[11px] sm:tracking-[0.08em]">
                {workflow.flow}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--sc-paper)]/65">{workflow.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </StudioCraftContainer>
    </section>
  );
}
