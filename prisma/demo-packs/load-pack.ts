import type { DemoPack, DemoPackId } from './types';
import { VERTICAL_SHOWCASE_PACK_IDS } from './types';
import { genericPack } from './generic/pack';
import { petroleumRetailPack } from './petroleum-retail/pack';
import { imaraSaccoPack } from './imara-sacco/pack';
import { cargoLogisticsPack } from './cargo-logistics/pack';
import { hospitalHealthcarePack } from './hospital-healthcare/pack';
import { travelAgencyPack } from './travel-agency/pack';

const PACKS: Record<DemoPackId, DemoPack> = {
  generic: genericPack,
  'petroleum-retail': petroleumRetailPack,
  'imara-sacco': imaraSaccoPack,
  'cargo-logistics': cargoLogisticsPack,
  'hospital-healthcare': hospitalHealthcarePack,
  'travel-agency': travelAgencyPack,
};

export const DEMO_PACK_IDS = Object.keys(PACKS) as DemoPackId[];
export { VERTICAL_SHOWCASE_PACK_IDS };

export function resolveDemoPackId(raw?: string | null): DemoPackId {
  const value = (raw ?? process.env.DEMO_PACK ?? 'generic').trim().toLowerCase();
  if (value in PACKS) return value as DemoPackId;
  const available = DEMO_PACK_IDS.join(', ');
  throw new Error(`Unknown DEMO_PACK "${raw ?? value}". Available packs: ${available}`);
}

export function loadDemoPack(packId?: string | null): DemoPack {
  const id = resolveDemoPackId(packId);
  const pack = PACKS[id];
  console.log(`→ Demo pack: ${pack.label} (${pack.id})`);
  return pack;
}
