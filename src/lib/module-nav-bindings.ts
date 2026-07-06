/**
 * MOD-02 (RAV-286): Nav item → module bindings derived from the nav catalog + route resolver.
 */
import { getDashboardNavCatalogSections } from '@/lib/dashboard-nav-catalog';
import type { ModuleKey } from '@/lib/module-catalog';

function normalizeNavHref(href: string): string {
  return href.split('?')[0] ?? href;
}

export function buildNavItemModules(
  resolveModule: (pathname: string) => ModuleKey | null,
): Record<string, ModuleKey> {
  const map: Record<string, ModuleKey> = {};

  for (const section of getDashboardNavCatalogSections()) {
    for (const item of section.items) {
      const path = normalizeNavHref(item.href);
      const module = resolveModule(path);
      if (module) map[path] = module;
    }
  }

  return map;
}
