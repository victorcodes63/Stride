/**
 * Pre-login org resolution by email domain (AUTH-03/04).
 */

import { AUTH_PUBLIC_LOOKUP_ORG_SENTINEL, withAuthPublicLookup } from '@/lib/auth/auth-public-lookup';
import { withOrgContext } from '@/lib/org-context';
import { isCustomerProductionCell } from '@/lib/deployment-cell';
import { prisma } from '@/lib/prisma';
import type { AuthProvider } from '@prisma/client';
import {
  ensureOrgAuthConfig,
  isProviderEnabledForAudience,
  isSsoEnforced,
  primaryAuthMethod,
  seedLegacyDomainsIfEmpty,
  type OrgAuthConfigSnapshot,
} from '@/lib/auth/org-auth-config';
import type { PortalAudience } from '@/lib/company-setup-auth';
import type { PortalAuthMethod } from '@/lib/company-setup-auth';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-constants';

export type ResolvedOrgForEmail = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  emailDomain: string;
  authConfig: OrgAuthConfigSnapshot;
  staffAuthMethod: PortalAuthMethod;
  essAuthMethod: PortalAuthMethod;
  credentialsAllowed: boolean;
  verifiedDomain: boolean;
};

function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0) return null;
  return normalized.slice(at + 1);
}

async function findVerifiedDomainRows(
  emailDomain: string,
): Promise<Array<{ organizationId: string; createdAt: Date }>> {
  return withAuthPublicLookup(async (db) => {
    const exact = await db.organizationEmailDomain.findMany({
      where: { domain: emailDomain, verifiedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { organizationId: true, createdAt: true },
    });
    if (exact.length > 0) return exact;

    const parts = emailDomain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(i).join('.');
      const parentRows = await db.organizationEmailDomain.findMany({
        where: { domain: parent, verifiedAt: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { organizationId: true, createdAt: true },
      });
      if (parentRows.length > 0) return parentRows;
    }
    return [];
  });
}

async function listMemberOrgIdsForLogin(userId: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${AUTH_PUBLIC_LOOKUP_ORG_SENTINEL}, true)`;
    await tx.$executeRaw`SELECT set_config('app.login_user_id', ${userId}, true)`;
    const rows = await tx.organizationMembership.findMany({
      where: { userId, status: 'active' },
      select: { organizationId: true },
    });
    return rows.map((row) => row.organizationId);
  });
}

async function pickVerifiedDomainRow(
  rows: Array<{ organizationId: string; createdAt: Date }>,
  userId?: string | null,
): Promise<{ organizationId: string } | null> {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  if (userId) {
    const memberOrgIds = new Set(await listMemberOrgIdsForLogin(userId));
    const memberMatch = rows.find((row) => memberOrgIds.has(row.organizationId));
    if (memberMatch) return memberMatch;
  }

  let candidates = rows;
  if (isCustomerProductionCell()) {
    const nonDefault = rows.filter((row) => row.organizationId !== DEFAULT_ORGANIZATION_ID);
    if (nonDefault.length > 0) candidates = nonDefault;
  }

  return candidates[0] ?? rows[0] ?? null;
}

async function findOrgByVerifiedDomain(
  emailDomain: string,
  userId?: string | null,
): Promise<{ organizationId: string; name: string; slug: string } | null> {
  const rows = await findVerifiedDomainRows(emailDomain);
  const domainRow = await pickVerifiedDomainRow(rows, userId);
  if (!domainRow) return null;

  // Organization RLS requires app.current_org — domain lookup uses auth_public_lookup only.
  return withOrgContext(domainRow.organizationId, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: domainRow.organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!org) return null;
    return {
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
    };
  });
}

async function isDomainVerified(organizationId: string, emailDomain: string): Promise<boolean> {
  return withAuthPublicLookup(async (db) => {
    const exact = await db.organizationEmailDomain.findFirst({
      where: { organizationId, domain: emailDomain, verifiedAt: { not: null } },
    });
    if (exact) return true;

    const parts = emailDomain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(i).join('.');
      const parentRow = await db.organizationEmailDomain.findFirst({
        where: { organizationId, domain: parent, verifiedAt: { not: null } },
      });
      if (parentRow) return true;
    }
    return false;
  });
}

export async function isEmailDomainVerifiedForOrg(
  organizationId: string,
  emailDomain: string,
): Promise<boolean> {
  return isDomainVerified(organizationId, emailDomain);
}

export async function resolveOrgByEmail(
  email: string,
  audience: PortalAudience = 'staff',
  options?: { userId?: string | null },
): Promise<ResolvedOrgForEmail | null> {
  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) return null;

  let org = await findOrgByVerifiedDomain(emailDomain, options?.userId);

  if (!org && !isCustomerProductionCell()) {
    await seedLegacyDomainsIfEmpty(DEFAULT_ORGANIZATION_ID);
    org = await findOrgByVerifiedDomain(emailDomain, options?.userId);
  }

  if (!org) {
    return null;
  }

  const authConfig = await ensureOrgAuthConfig(org.organizationId);
  const staffMethod = primaryAuthMethod(authConfig.staffEnabledProviders);
  const essMethod = primaryAuthMethod(authConfig.essEnabledProviders);
  const method = audience === 'staff' ? staffMethod : essMethod;
  const enforced = isSsoEnforced(authConfig, audience);
  const credentialsEnabled = isProviderEnabledForAudience(authConfig, audience, 'credentials');
  const verified = await isDomainVerified(org.organizationId, emailDomain);

  return {
    organizationId: org.organizationId,
    organizationName: org.name,
    organizationSlug: org.slug,
    emailDomain,
    authConfig,
    staffAuthMethod: staffMethod,
    essAuthMethod: essMethod,
    credentialsAllowed: credentialsEnabled && !enforced,
    verifiedDomain: verified,
  };
}

export function getEnabledOAuthProvidersForOrg(
  resolved: ResolvedOrgForEmail,
  audience: PortalAudience,
): AuthProvider[] {
  const list =
    audience === 'staff'
      ? resolved.authConfig.staffEnabledProviders
      : resolved.authConfig.essEnabledProviders;
  return list.filter((p) => p === 'microsoft' || p === 'google');
}

export function pickPrimaryAuthMethod(
  resolved: ResolvedOrgForEmail,
  audience: PortalAudience,
): PortalAuthMethod {
  return audience === 'staff' ? resolved.staffAuthMethod : resolved.essAuthMethod;
}
