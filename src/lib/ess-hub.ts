import type { ModuleKey } from '@/lib/modules';
import type { EnabledModulesMap } from '@/lib/nav-modules';
import { ESS_NAV_MODULES } from '@/lib/module-routes';
import type { EssHubTileDef } from '@/lib/ess-nav-catalog';

export function isEssHubTileVisible(
  tile: EssHubTileDef,
  enabled: EnabledModulesMap,
): boolean {
  if (tile.module === 'ess') return enabled.ess !== false;
  const mod = tile.module as ModuleKey;
  return enabled[mod] !== false;
}

export function filterEssHubTiles(
  tiles: EssHubTileDef[],
  enabled: EnabledModulesMap,
): EssHubTileDef[] {
  return tiles.filter((t) => isEssHubTileVisible(t, enabled));
}

export function isEssDeepLinkVisible(href: string, enabled: EnabledModulesMap): boolean {
  if (href === '/ess' || href.startsWith('/ess/more') || href.startsWith('/ess/profile')) {
    return enabled.ess !== false;
  }
  const mod = ESS_NAV_MODULES[href];
  if (mod) return enabled[mod] !== false;
  if (href.startsWith('/ess/pay')) return enabled.payroll !== false;
  if (href.startsWith('/ess/work')) return enabled.leave !== false || enabled.time !== false;
  if (href.startsWith('/ess/team')) return enabled.leave !== false || enabled.time !== false;
  if (href.startsWith('/ess/onboarding') || href.startsWith('/ess/documents') || href.startsWith('/ess/credentials')) {
    return enabled.core !== false;
  }
  if (href.startsWith('/ess/rota') || href.startsWith('/ess/attendance')) return enabled.time !== false;
  if (href.startsWith('/ess/hse')) return enabled.hse !== false;
  if (href.startsWith('/ess/assets')) return enabled.assets !== false;
  if (href.startsWith('/ess/performance')) return enabled.performance !== false;
  return enabled.ess !== false;
}
