'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { EssHubTileDef } from '@/lib/ess-nav-catalog';

type Props = {
  tile: EssHubTileDef;
  badge?: number | string;
};

export function EssHubTile({ tile, badge }: Props) {
  const Icon = tile.icon;
  return (
    <Link
      href={tile.href}
      className="ess-card-flat flex min-h-[78px] items-center gap-3 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-[var(--ess-primary)] active:translate-y-0"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-bold text-[var(--ess-text)]">{tile.label}</span>
          {badge !== undefined && Number(badge) > 0 ? (
            <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">
              {Number(badge) > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-sm text-[var(--ess-muted)]">{tile.description}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[var(--ess-subtle)]" aria-hidden />
    </Link>
  );
}
