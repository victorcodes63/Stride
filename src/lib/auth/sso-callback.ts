/**
 * Shared staff SSO callback — org resolution, domain checks, JIT provisioning (AUTH-04).
 */

import type { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { buildStaffSessionForUser } from '@/lib/staff-session-issue';
import { membershipForLogin } from '@/lib/org-membership';
import {
  isProviderEnabledForAudience,
  type OrgAuthConfigSnapshot,
} from '@/lib/auth/org-auth-config';
import { resolveOrgByEmail } from '@/lib/auth/resolve-org-by-email';
import type { MicrosoftOAuthProfile } from '@/lib/oauth/microsoft-email';

export type SsoProvider = 'microsoft' | 'google';

export type SsoCallbackInput = {
  email: string;
  provider: SsoProvider;
  microsoft?: Pick<MicrosoftOAuthProfile, 'tenantId' | 'idp'>;
  googleHostedDomain?: string;
};

export type SsoCallbackSuccess = {
  ok: true;
  userId: string;
  email: string;
  organizationId: string;
  sessionValue: string;
};

export type SsoCallbackFailure = {
  ok: false;
  reason: 'domain' | 'no_account' | 'inactive' | 'oauth' | 'provider_disabled' | 'consumer_account' | 'tenant_mismatch';
};

const CONSUMER_IDP = 'live.com';

function isConsumerMicrosoftAccount(profile?: Pick<MicrosoftOAuthProfile, 'idp'>): boolean {
  if (!profile?.idp) return false;
  return profile.idp.toLowerCase().includes(CONSUMER_IDP);
}

function isConsumerGoogleEmail(email: string, hostedDomain?: string): boolean {
  if (hostedDomain) return false;
  return email.endsWith('@gmail.com') || email.endsWith('@googlemail.com');
}

async function loadAuthConfigPublic(organizationId: string): Promise<OrgAuthConfigSnapshot | null> {
  const row = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.auth_public_lookup', 'true', true)`;
    return tx.organizationAuthConfig.findUnique({ where: { organizationId } });
  });
  if (!row) return null;
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

async function findOrProvisionUser(
  email: string,
  organizationId: string,
  authConfig: OrgAuthConfigSnapshot,
): Promise<{ userId: string; role: UserRole; isActive: boolean } | null> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true },
  });

  if (existing) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId: existing.id, organizationId },
      },
    });
    if (!membership && authConfig.jitProvisioning && existing.isActive) {
      await withOrgContext(organizationId, (tx) =>
        tx.organizationMembership.create({
          data: {
            userId: existing.id,
            organizationId,
            role: 'staff',
            updatedAt: new Date(),
          },
        }),
      );
    }
    return existing;
  }

  if (!authConfig.jitProvisioning) return null;

  const created = await withOrgContext(organizationId, async (tx) => {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const user = await tx.user.create({
      data: {
        email,
        name: email.split('@')[0] ?? email,
        passwordHash,
        role: 'staff',
        isActive: true,
        updatedAt: new Date(),
      },
      select: { id: true, role: true, isActive: true },
    });
    await tx.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId,
        role: 'staff',
        updatedAt: new Date(),
      },
    });
    return user;
  });

  return created;
}

export async function completeStaffSsoLogin(
  input: SsoCallbackInput,
): Promise<SsoCallbackSuccess | SsoCallbackFailure> {
  const email = input.email.trim().toLowerCase();
  if (!email || !process.env.DATABASE_URL) {
    return { ok: false, reason: 'oauth' };
  }

  const resolved = await resolveOrgByEmail(email, 'staff');
  if (!resolved || !resolved.verifiedDomain) {
    return { ok: false, reason: 'domain' };
  }

  const authConfig =
    (await loadAuthConfigPublic(resolved.organizationId)) ?? resolved.authConfig;

  const providerKey = input.provider === 'microsoft' ? 'microsoft' : 'google';
  if (!isProviderEnabledForAudience(authConfig, 'staff', providerKey)) {
    return { ok: false, reason: 'provider_disabled' };
  }

  if (input.provider === 'microsoft') {
    if (isConsumerMicrosoftAccount(input.microsoft)) {
      return { ok: false, reason: 'consumer_account' };
    }
    if (
      authConfig.lockedMsTenantId &&
      input.microsoft?.tenantId &&
      authConfig.lockedMsTenantId !== input.microsoft.tenantId
    ) {
      return { ok: false, reason: 'tenant_mismatch' };
    }
  }

  if (input.provider === 'google') {
    if (isConsumerGoogleEmail(email, input.googleHostedDomain)) {
      return { ok: false, reason: 'consumer_account' };
    }
    const allowedDomains = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.auth_public_lookup', 'true', true)`;
      return tx.organizationEmailDomain.findMany({
        where: { organizationId: resolved.organizationId, verifiedAt: { not: null } },
        select: { domain: true },
      });
    });
    const domainList = allowedDomains.map((d) => d.domain);
    const emailDomain = resolved.emailDomain;
    const hdOk =
      !input.googleHostedDomain ||
      domainList.some(
        (d) => input.googleHostedDomain === d || input.googleHostedDomain!.endsWith(`.${d}`),
      );
    const domainOk = domainList.some(
      (d) => emailDomain === d || emailDomain.endsWith(`.${d}`),
    );
    if (!domainOk || !hdOk) {
      return { ok: false, reason: 'domain' };
    }
  }

  const user = await findOrProvisionUser(email, resolved.organizationId, authConfig);
  if (!user) return { ok: false, reason: 'no_account' };
  if (!user.isActive) return { ok: false, reason: 'inactive' };

  await membershipForLogin(user.id, user.role, resolved.organizationId);

  const sessionProvider = input.provider === 'microsoft' ? 'ms' : 'google';
  const sessionValue = await buildStaffSessionForUser({
    provider: sessionProvider,
    userId: user.id,
    userRole: user.role,
    email,
    preferredOrgId: resolved.organizationId,
  });

  return {
    ok: true,
    userId: user.id,
    email,
    organizationId: resolved.organizationId,
    sessionValue,
  };
}
