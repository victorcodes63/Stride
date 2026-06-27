/**
 * Per-org auth config (AUTH-02). Replaces STAFF_ALLOWED_DOMAIN env for pooled deployments.
 */

import type { AuthProvider, OrganizationAuthConfig } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-constants';
import { getStaffAllowedDomains } from '@/lib/staff-allowed-domains';
import type { PortalAuthMethod } from '@/lib/company-setup-auth';
import type { PortalAudience } from '@/lib/company-setup-auth';

export type OrgAuthConfigSnapshot = {
  organizationId: string;
  staffEnabledProviders: AuthProvider[];
  essEnabledProviders: AuthProvider[];
  ssoEnforcedStaff: boolean;
  ssoEnforcedEss: boolean;
  jitProvisioning: boolean;
  lockedMsTenantId: string | null;
};

const DEFAULT_SNAPSHOT: OrgAuthConfigSnapshot = {
  organizationId: DEFAULT_ORGANIZATION_ID,
  staffEnabledProviders: ['credentials'],
  essEnabledProviders: ['credentials'],
  ssoEnforcedStaff: false,
  ssoEnforcedEss: false,
  jitProvisioning: false,
  lockedMsTenantId: null,
};

export function authProviderToPortalMethod(provider: AuthProvider): PortalAuthMethod {
  if (provider === 'microsoft') return 'microsoft';
  if (provider === 'google') return 'google';
  return 'credentials';
}

export function portalMethodToAuthProvider(method: PortalAuthMethod): AuthProvider {
  return method;
}

export function primaryAuthMethod(
  providers: AuthProvider[],
): PortalAuthMethod {
  if (providers.includes('microsoft')) return 'microsoft';
  if (providers.includes('google')) return 'google';
  return 'credentials';
}

export function snapshotFromRow(row: OrganizationAuthConfig): OrgAuthConfigSnapshot {
  return {
    organizationId: row.organizationId,
    staffEnabledProviders: row.staffEnabledProviders,
    essEnabledProviders: row.essEnabledProviders,
    ssoEnforcedStaff: row.ssoEnforcedStaff,
    ssoEnforcedEss: row.ssoEnforcedEss,
    jitProvisioning: row.jitProvisioning,
    lockedMsTenantId: row.lockedMsTenantId,
  };
}

export async function getOrgAuthConfig(
  organizationId: string,
): Promise<OrgAuthConfigSnapshot | null> {
  const row = await withOrgContext(organizationId, (tx) =>
    tx.organizationAuthConfig.findUnique({ where: { organizationId } }),
  );
  return row ? snapshotFromRow(row) : null;
}

export async function ensureOrgAuthConfig(
  organizationId: string,
): Promise<OrgAuthConfigSnapshot> {
  const existing = await getOrgAuthConfig(organizationId);
  if (existing) return existing;

  return withOrgContext(organizationId, async (tx) => {
    const row = await tx.organizationAuthConfig.create({
      data: {
        organizationId,
        staffEnabledProviders: ['credentials'],
        essEnabledProviders: ['credentials'],
        updatedAt: new Date(),
      },
    });
    return snapshotFromRow(row);
  });
}

export function isProviderEnabledForAudience(
  config: OrgAuthConfigSnapshot,
  audience: PortalAudience,
  provider: AuthProvider,
): boolean {
  const list =
    audience === 'staff' ? config.staffEnabledProviders : config.essEnabledProviders;
  return list.includes(provider);
}

export function isSsoEnforced(
  config: OrgAuthConfigSnapshot,
  audience: PortalAudience,
): boolean {
  return audience === 'staff' ? config.ssoEnforcedStaff : config.ssoEnforcedEss;
}

/** Legacy env domains → seed default org verified domains on first read (migration aid). */
export async function seedLegacyDomainsIfEmpty(organizationId: string): Promise<void> {
  const count = await withOrgContext(organizationId, (tx) =>
    tx.organizationEmailDomain.count({ where: { organizationId } }),
  );
  if (count > 0) return;

  const legacyDomains = getStaffAllowedDomains();
  if (legacyDomains.length === 0) return;

  await withOrgContext(organizationId, async (tx) => {
    for (const domain of legacyDomains) {
      await tx.organizationEmailDomain.upsert({
        where: {
          organizationId_domain: { organizationId, domain },
        },
        create: {
          organizationId,
          domain,
          verificationToken: `legacy-${domain}`,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
        update: {},
      });
    }
  });
}

export async function upsertOrgAuthConfig(
  organizationId: string,
  input: Partial<
    Pick<
      OrgAuthConfigSnapshot,
      | 'staffEnabledProviders'
      | 'essEnabledProviders'
      | 'ssoEnforcedStaff'
      | 'ssoEnforcedEss'
      | 'jitProvisioning'
      | 'lockedMsTenantId'
    >
  >,
): Promise<OrgAuthConfigSnapshot> {
  return withOrgContext(organizationId, async (tx) => {
    const row = await tx.organizationAuthConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        staffEnabledProviders: input.staffEnabledProviders ?? ['credentials'],
        essEnabledProviders: input.essEnabledProviders ?? ['credentials'],
        ssoEnforcedStaff: input.ssoEnforcedStaff ?? false,
        ssoEnforcedEss: input.ssoEnforcedEss ?? false,
        jitProvisioning: input.jitProvisioning ?? false,
        lockedMsTenantId: input.lockedMsTenantId ?? null,
        updatedAt: new Date(),
      },
      update: {
        ...(input.staffEnabledProviders !== undefined && {
          staffEnabledProviders: input.staffEnabledProviders,
        }),
        ...(input.essEnabledProviders !== undefined && {
          essEnabledProviders: input.essEnabledProviders,
        }),
        ...(input.ssoEnforcedStaff !== undefined && { ssoEnforcedStaff: input.ssoEnforcedStaff }),
        ...(input.ssoEnforcedEss !== undefined && { ssoEnforcedEss: input.ssoEnforcedEss }),
        ...(input.jitProvisioning !== undefined && { jitProvisioning: input.jitProvisioning }),
        ...(input.lockedMsTenantId !== undefined && { lockedMsTenantId: input.lockedMsTenantId }),
        updatedAt: new Date(),
      },
    });
    return snapshotFromRow(row);
  });
}
