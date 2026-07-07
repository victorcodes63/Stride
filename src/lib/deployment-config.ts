/**
 * Per-deployment configuration for dedicated client instances.
 * Values come from environment variables — never hardcode client names in runtime code.
 */

import 'server-only';

import { brand } from '@/lib/brand';
import {
  canAccessCompanySetup,
  getDeploymentTier,
  type DeploymentTier,
} from '@/lib/deployment-tier-shared';
import {
  envTenantDisplayName,
  GENERIC_ORG_PLACEHOLDER,
  isDemoSandboxCell,
} from '@/lib/deployment-cell';
import {
  getDefaultCountry,
  getDefaultCurrency,
  isMultiEntityEnvEnabled,
  isDemoMode,
  isPublicDemoMode,
  type DeploymentCountry,
  type WorkspaceDefaults,
} from '@/lib/deployment-config-shared';

export {
  isDemoMode,
  isPublicDemoMode,
  isLocalDevAllModules,
  isPublicLocalDevAllModules,
  getDefaultCountry,
  getDefaultCurrency,
  isMultiEntityEnvEnabled,
  getWorkspaceDefaults,
  type DeploymentCountry,
  type WorkspaceDefaults,
} from '@/lib/deployment-config-shared';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
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
  return buildDeploymentSummary(getDeploymentTier());
}

export async function getDeploymentSummaryAsync(): Promise<DeploymentSummary> {
  const { resolveDeploymentTier } = await import('@/lib/deployment-tier-server');
  const tier = await resolveDeploymentTier();
  return buildDeploymentSummary(tier);
}

function buildDeploymentSummary(deploymentTier: DeploymentTier): DeploymentSummary {
  return {
    demoMode: isDemoMode(),
    publicDemoMode: isPublicDemoMode(),
    country: getDefaultCountry(),
    currency: getDefaultCurrency(),
    orgName: isDemoSandboxCell()
      ? (envTenantDisplayName() ?? GENERIC_ORG_PLACEHOLDER)
      : GENERIC_ORG_PLACEHOLDER,
    appName: brand.appName,
    multiEntityEnvEnabled: isMultiEntityEnvEnabled(),
    deploymentTier,
    canAccessCompanySetup: canAccessCompanySetup(),
  };
}
