/**
 * Per-deployment configuration for dedicated client instances.
 * Values come from environment variables — never hardcode client names in runtime code.
 */

import { brand } from '@/lib/brand';
import {
  canAccessCompanySetup,
  getDeploymentTier,
  type DeploymentTier,
} from '@/lib/deployment-tier';

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

/** True when this instance is a sales/demo environment (shows demo login hints, allows demo seed). */
export function isDemoMode(): boolean {
  return parseBoolean(trimEnv('DEMO_MODE'), false);
}

/** Client-safe demo flag — set NEXT_PUBLIC_DEMO_MODE=true alongside DEMO_MODE for login hints. */
export function isPublicDemoMode(): boolean {
  return parseBoolean(trimEnv('NEXT_PUBLIC_DEMO_MODE'), isDemoMode());
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
export function getWorkspaceDefaults(): WorkspaceDefaults {
  const country = getDefaultCountry();
  return {
    name: trimEnv('PROVISION_ORG_NAME') ?? brand.orgName,
    employeeNumberPrefix: trimEnv('PROVISION_EMPLOYEE_PREFIX') ?? (country === 'UG' ? 'EMP' : 'EMP'),
    currency: getDefaultCurrency(),
    contactName: trimEnv('PROVISION_CONTACT_NAME') ?? null,
    contactEmail: trimEnv('PROVISION_CONTACT_EMAIL') ?? brand.contactEmail,
    contactPhone: trimEnv('PROVISION_CONTACT_PHONE') ?? (brand.contactPhone || null),
    entityCode: country === 'UG' ? 'ug' : 'ke',
  };
}

export type ProvisionAdminConfig = {
  email: string;
  name: string;
  password: string;
};

export function getProvisionAdminConfig(): ProvisionAdminConfig {
  const email = trimEnv('PROVISION_ADMIN_EMAIL');
  const password = trimEnv('PROVISION_ADMIN_PASSWORD') ?? trimEnv('STAFF_PASSWORD');
  if (!email) {
    throw new Error(
      'PROVISION_ADMIN_EMAIL is required for production seed. Set it in your environment before running seed:production.',
    );
  }
  if (!password) {
    throw new Error(
      'PROVISION_ADMIN_PASSWORD or STAFF_PASSWORD is required for production seed.',
    );
  }
  return {
    email,
    name: trimEnv('PROVISION_ADMIN_NAME') ?? 'System Administrator',
    password,
  };
}

export type DeploymentSummary = {
  demoMode: boolean;
  publicDemoMode: boolean;
  country: DeploymentCountry;
  currency: string;
  orgName: string;
  appName: string;
  multiEntityEnvEnabled: boolean;
  deploymentTier: DeploymentTier;
  canAccessCompanySetup: boolean;
};

export function getDeploymentSummary(): DeploymentSummary {
  return {
    demoMode: isDemoMode(),
    publicDemoMode: isPublicDemoMode(),
    country: getDefaultCountry(),
    currency: getDefaultCurrency(),
    orgName: getWorkspaceDefaults().name,
    appName: brand.appName,
    multiEntityEnvEnabled: isMultiEntityEnvEnabled(),
    deploymentTier: getDeploymentTier(),
    canAccessCompanySetup: canAccessCompanySetup(),
  };
}
