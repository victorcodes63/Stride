import type { ModuleKey } from '@/lib/modules';
import { getModuleLabel } from '@/lib/modules';

export function moduleUpgradeMessage(moduleKey: ModuleKey): string {
  const label = getModuleLabel(moduleKey);
  return `${label} is not included on your current Stride plan. Contact Raven Tech Group to upgrade — hello@raventechgroup.com`;
}

export function seatLimitUpgradeMessage(limit: number): string {
  return `Your plan includes up to ${limit} employees. Contact Raven Tech Group to add seats — hello@raventechgroup.com`;
}

export const RAVEN_COMMERCIAL_CONTACT = {
  email: 'hello@raventechgroup.com',
  phone: '+254 700 000 000',
  upgradeUrl: 'mailto:hello@raventechgroup.com?subject=Stride%20plan%20upgrade',
};
