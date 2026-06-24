'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssHubTile } from '@/components/ess/EssHubTile';
import { filterEssHubTiles } from '@/lib/ess-hub';
import type { EssHubTileDef } from '@/lib/ess-nav-catalog';
import { useEssApp } from '@/contexts/EssAppContext';
import { EssEmptyState } from '@/components/ess/EssUi';

type Props = {
  title: string;
  subtitle?: string;
  tiles: EssHubTileDef[];
  backHref?: string;
  badges?: Record<string, number>;
};

export function EssHubPage({ title, subtitle, tiles, backHref, badges: externalBadges }: Props) {
  const { enabledModules } = useEssApp();
  const visible = filterEssHubTiles(tiles, enabledModules);
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/ess/home-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { badges?: Record<string, number> } | null) => {
        if (data?.badges) setBadges(data.badges);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <EssPageHeader title={title} subtitle={subtitle} backHref={backHref} />
      <div className="grid gap-3">
        {visible.map((tile) => (
          <EssHubTile
            key={tile.href}
            tile={tile}
            badge={tile.badgeKey ? (externalBadges?.[tile.badgeKey] ?? badges[tile.badgeKey]) : undefined}
          />
        ))}
        {!visible.length ? (
          <EssEmptyState title="Nothing enabled yet" message="No modules are enabled for this section." />
        ) : null}
      </div>
    </div>
  );
}
