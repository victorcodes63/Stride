/**
 * Client/edge-safe deployment env helpers — no brand path imports or server DB access.
 */

import { brandConfig } from '@/lib/brand.config';
import { resolveTenantDisplayName } from '@/lib/deployment-cell';

export {
  isDemoMode,
  isPublicDemoMode,
  isLocalDevAllModules,
  isPublicLocalDevAllModules,
} from '@/lib/deployment-flags';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

export type DeploymentCountry = 'KE' | 'UG';

export function getDefaultCountry(): DeploymentCountry {
  const raw = trimEnv('DEFAULT_COUNTRY')?.toUpperCase();
  if (raw === 'UG') return 'UG';
  return 'KE';
}

export function getDefaultCurrency(): string {
  return trimEnv('PROVISION_CURRENCY') ?? (getDefaultCountry() === 'UG' ? 'UGX' : 'KES');
}

/** Commercial gate: multi-entity capability purchased at provision time. */
export function isMultiEntityEnvEnabled(): boolean {
  return parseBoolean(trimEnv('MULTI_ENTITY_ENABLED'), false);
}

export type WorkspaceDefaults = {
  name: string;
  employeeNumberPrefix: string;
  currency: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  entityCode: 'ke' | 'ug';
};

/** Defaults used when bootstrapping the primary workspace on a fresh database. */
export function getWorkspaceDefaults(organizationName?: string | null): WorkspaceDefaults {
  const country = getDefaultCountry();
  return {
    name: resolveTenantDisplayName(organizationName),
    employeeNumberPrefix: trimEnv('PROVISION_EMPLOYEE_PREFIX') ?? 'EMP',
    currency: getDefaultCurrency(),
    contactName: trimEnv('PROVISION_CONTACT_NAME') ?? null,
    contactEmail: trimEnv('PROVISION_CONTACT_EMAIL') ?? brandConfig.supportEmail,
    contactPhone: trimEnv('PROVISION_CONTACT_PHONE') ?? null,
    entityCode: country === 'UG' ? 'ug' : 'ke',
  };
}
