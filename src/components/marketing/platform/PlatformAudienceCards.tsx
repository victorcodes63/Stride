'use client';

import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { ShieldCheck, TreeStructure, UsersThree } from '@phosphor-icons/react';
import { Stagger, StaggerItem } from '@/components/marketing/motion';
import { PLATFORM_AUDIENCE } from '@/lib/marketing-config';

const ICONS: PhosphorIcon[] = [UsersThree, TreeStructure, ShieldCheck];

/** Three audience cards in the shared card style, the first one in ink for emphasis. */
export function PlatformAudienceCards() {
  return (
    <Stagger className="mt-14 grid gap-4 md:grid-cols-3 lg:mt-20" delayChildren={0.1}>
      {PLATFORM_AUDIENCE.map((segment, index) => {
        const Icon = ICONS[index] ?? UsersThree;
        const featured = index === 0;
        return (
          <StaggerItem
            key={segment.title}
            as="article"
            className={`flex flex-col rounded-[20px] p-7 sm:p-8 ${
              featured
                ? 'sc-on-ink bg-[var(--sc-ink)] text-white shadow-[0_24px_60px_-32px_rgba(26,23,20,0.6)]'
                : 'border border-[var(--sc-line)] bg-white shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-32px_rgba(26,23,20,0.22)]'
            }`}
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${
                featured ? 'bg-[var(--sc-coral)] text-white' : 'bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]'
              }`}
            >
              <Icon size={24} weight="duotone" aria-hidden />
            </span>
            <h3
              className={`mt-8 text-[clamp(1.5rem,2.4vw,2rem)] font-medium leading-tight tracking-[-0.025em] ${
                featured ? 'text-white' : 'text-[var(--sc-ink)]'
              }`}
            >
              {segment.title}
            </h3>
            <p className={`mt-3 text-[15px] leading-[1.7] ${featured ? 'text-white/65' : 'text-[var(--sc-ink-muted)]'}`}>
              {segment.body}
            </p>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
