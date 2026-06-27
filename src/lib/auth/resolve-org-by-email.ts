/**
 * Pre-login org resolution by email domain (AUTH-03/04).
 */

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

/** Set RLS scope for unauthenticated login lookups (verified domains + auth config). */
async function withAuthPublicLookup<T>(fn: (db: typeof prisma) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.auth_public_lookup', 'true', true)`;
    return fn(tx as typeof prisma);
  });
}

async function findOrgByVerifiedDomain(
  emailDomain: string,
): Promise<{ organizationId: string; name: string; slug: string } | null> {
  return withAuthPublicLookup(async (db) => {
    const match = await db.organizationEmailDomain.findFirst({
      where: {
        domain: emailDomain,
        verifiedAt: { not: null },
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (match) {
      return {
        organizationId: match.organizationId,
        name: match.organization.name,
        slug: match.organization.slug,
      };
    }

    // Subdomain match: user@mail.acme.co.ke → verified acme.co.ke
    const parts = emailDomain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(i).join('.');
      const parentMatch = await db.organizationEmailDomain.findFirst({
        where: { domain: parent, verifiedAt: { not: null } },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      });
      if (parentMatch) {
        return {
          organizationId: parentMatch.organizationId,
          name: parentMatch.organization.name,
          slug: parentMatch.organization.slug,
        };
      }
    }
    return null;
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

export async function resolveOrgByEmail(
  email: string,
  audience: PortalAudience = 'staff',
): Promise<ResolvedOrgForEmail | null> {
  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) return null;

  let org = await findOrgByVerifiedDomain(emailDomain);

  if (!org) {
    await seedLegacyDomainsIfEmpty(DEFAULT_ORGANIZATION_ID);
    org = await findOrgByVerifiedDomain(emailDomain);
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
