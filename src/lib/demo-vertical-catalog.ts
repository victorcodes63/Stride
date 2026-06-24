export type VerticalShowcasePackId =
  | 'imara-sacco'
  | 'petroleum-retail'
  | 'cargo-logistics'
  | 'hospital-healthcare'
  | 'travel-agency';

export type DemoVerticalMeta = {
  id: VerticalShowcasePackId;
  label: string;
  sector: string;
  emoji: string;
};

/** Labels for the multi-vertical company context switcher. */
export const DEMO_VERTICAL_CATALOG: Record<VerticalShowcasePackId, DemoVerticalMeta> = {
  'imara-sacco': {
    id: 'imara-sacco',
    label: 'Heritage Members SACCO',
    sector: 'SACCO & financial services',
    emoji: '🏦',
  },
  'petroleum-retail': {
    id: 'petroleum-retail',
    label: 'Northline Petroleum',
    sector: 'Fuel import & retail',
    emoji: '⛽',
  },
  'cargo-logistics': {
    id: 'cargo-logistics',
    label: 'SwiftFreight East Africa',
    sector: 'Cargo & logistics',
    emoji: '🚛',
  },
  'hospital-healthcare': {
    id: 'hospital-healthcare',
    label: 'Amani Medical Centre',
    sector: 'Hospital & healthcare',
    emoji: '🏥',
  },
  'travel-agency': {
    id: 'travel-agency',
    label: 'Horizon Travels',
    sector: 'Travel & tourism',
    emoji: '✈️',
  },
};

const COMPOSITE_SLUG = /^([a-z][a-z0-9-]*)__(ke|ug)$/;

export function parseVerticalFromEntitySlug(entityId: string): DemoVerticalMeta | null {
  const match = entityId.trim().toLowerCase().match(COMPOSITE_SLUG);
  if (!match) return null;
  const packId = match[1] as VerticalShowcasePackId;
  return DEMO_VERTICAL_CATALOG[packId] ?? null;
}
