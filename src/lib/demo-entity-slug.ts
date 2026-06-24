export const DEMO_CONTEXT_IDS = [
  'generic',
  'petroleum-retail',
  'imara-sacco',
  'cargo-logistics',
  'hospital-healthcare',
  'travel-agency',
] as const;
export type DemoContextId = (typeof DEMO_CONTEXT_IDS)[number];

const COMPOSITE_SLUG_RE = /^([a-z][a-z0-9-]*)__(ke|ug)$/;

function resolveContextId(raw?: string | null): DemoContextId {
  const value = (raw ?? process.env.DEMO_PACK ?? 'generic').trim().toLowerCase();
  if (DEMO_CONTEXT_IDS.includes(value as DemoContextId)) return value as DemoContextId;
  return 'generic';
}

/** Entity slug for a demo pack + country (e.g. `generic__ke`). */
export function demoEntitySlug(packId: string, country: 'ke' | 'ug'): string {
  const prefix = packId.trim().toLowerCase();
  if (process.env.DEMO_MULTI_CONTEXT === 'true' || process.env.DEMO_ENTITY_PREFIX?.trim()) {
    const entityPrefix = process.env.DEMO_ENTITY_PREFIX?.trim().toLowerCase() || prefix;
    return `${entityPrefix}__${country}`;
  }
  return country;
}

export function parseDemoEntitySlug(slug: string | null | undefined): {
  contextId: DemoContextId;
  statutoryId: 'ke' | 'ug';
  slug: string;
} {
  const normalized = (slug ?? '').trim().toLowerCase();
  const match = normalized.match(COMPOSITE_SLUG_RE);
  if (match) {
    const contextId = match[1] as DemoContextId;
    const statutoryId = match[2] as 'ke' | 'ug';
    if (DEMO_CONTEXT_IDS.includes(contextId)) {
      return { contextId, statutoryId, slug: normalized };
    }
  }
  const statutoryId: 'ke' | 'ug' = normalized === 'ug' ? 'ug' : 'ke';
  const contextId = resolveContextId(process.env.DEMO_PACK);
  return { contextId, statutoryId, slug: normalized || statutoryId };
}

export function companySetupKeyForContext(contextId: string): string {
  return `admin.company.setup:${contextId.trim().toLowerCase()}`;
}

export function isMultiContextDemoEnabled(): boolean {
  return process.env.DEMO_MULTI_CONTEXT === 'true';
}
