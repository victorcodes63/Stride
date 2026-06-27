/**
 * Sync Company Setup auth UI → OrganizationAuthConfig (AUTH-06/02).
 */

import type { AuthProvider } from '@prisma/client';
import type { CompanySetupSettings } from '@/lib/company-setup';
import type { PortalAuthMethod } from '@/lib/company-setup-auth';
import { upsertOrgAuthConfig } from '@/lib/auth/org-auth-config';

function methodToProviders(method: PortalAuthMethod): AuthProvider[] {
  if (method === 'microsoft') return ['microsoft'];
  if (method === 'google') return ['google'];
  return ['credentials'];
}

export async function syncCompanySetupToOrgAuth(
  organizationId: string,
  setup: CompanySetupSettings,
  options?: {
    ssoEnforcedStaff?: boolean;
    ssoEnforcedEss?: boolean;
    jitProvisioning?: boolean;
    lockedMsTenantId?: string | null;
  },
): Promise<void> {
  await upsertOrgAuthConfig(organizationId, {
    staffEnabledProviders: methodToProviders(setup.staffAuthMethod),
    essEnabledProviders: methodToProviders(setup.essAuthMethod),
    ssoEnforcedStaff: options?.ssoEnforcedStaff ?? false,
    ssoEnforcedEss: options?.ssoEnforcedEss ?? false,
    jitProvisioning: options?.jitProvisioning ?? false,
    lockedMsTenantId: options?.lockedMsTenantId ?? null,
  });
}
