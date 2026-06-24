'use client';

import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssHubTile } from '@/components/ess/EssHubTile';
import { ESS_MORE_GROUPS } from '@/lib/ess-nav-catalog';
import { filterEssHubTiles } from '@/lib/ess-hub';
import { useEssApp } from '@/contexts/EssAppContext';
import { EssSectionTitle } from '@/components/ess/EssUi';

export default function EssMorePage() {
  const { enabledModules } = useEssApp();

  return (
    <div>
      <EssPageHeader title="More" subtitle="Profile, records, and workplace" />
      <div className="space-y-6">
        {ESS_MORE_GROUPS.map((group) => {
          const items = filterEssHubTiles(group.items, enabledModules);
          if (!items.length) return null;
          return (
            <section key={group.title}>
              <EssSectionTitle eyebrow="Directory" title={group.title} />
              <div className="space-y-2">
                {items.map((tile) => (
                  <EssHubTile key={tile.href} tile={tile} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
