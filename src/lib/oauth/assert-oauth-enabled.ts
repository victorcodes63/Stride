import { NextResponse } from 'next/server';

import {
  isProviderEnabledForAudience,
  isSsoEnforced,
} from '@/lib/auth/org-auth-config';
import { resolveOrgByEmail } from '@/lib/auth/resolve-org-by-email';
import {
  isStrideGoogleOAuthConfigured,
  isStrideMicrosoftOAuthConfigured,
} from '@/lib/auth/platform-oauth';
import { loadCompanySetupSettings } from '@/lib/company-setup';
import type { PortalAudience } from '@/lib/company-setup-auth';
import { isOAuthProviderActive } from '@/lib/company-setup-auth';
import type { OAuthProviderKey } from '@/lib/auth-providers';
import type { OAuthAudience } from '@/lib/oauth-utils';

function loginPath(audience: OAuthAudience): string {
  return audience === 'ess' ? '/ess/login' : '/dashboard/login';
}

function oauthDisabledRedirect(request: Request, audience: OAuthAudience): NextResponse {
  return NextResponse.redirect(
    new URL(`${loginPath(audience)}?error=oauth_disabled`, request.url),
  );
}

function isPlatformOAuthConfigured(provider: OAuthProviderKey): boolean {
  return provider === 'microsoft'
    ? isStrideMicrosoftOAuthConfigured()
    : isStrideGoogleOAuthConfigured();
}

/** Per-tenant auth config (pooled cell) with deployment Company Setup fallback. */
export async function isOAuthProviderEnabledForLogin(
  audience: OAuthAudience,
  provider: OAuthProviderKey,
  email?: string | null,
): Promise<boolean> {
  if (!isPlatformOAuthConfigured(provider)) return false;

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && normalizedEmail.includes('@')) {
    const resolved = await resolveOrgByEmail(normalizedEmail, audience);
    if (resolved?.verifiedDomain) {
      return isProviderEnabledForAudience(resolved.authConfig, audience, provider);
    }
  }

  const setup = await loadCompanySetupSettings();
  return isOAuthProviderActive(setup, audience, provider);
}

export async function isCredentialsLoginEnabledForEmail(
  audience: PortalAudience,
  email?: string | null,
): Promise<boolean> {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && normalizedEmail.includes('@')) {
    const resolved = await resolveOrgByEmail(normalizedEmail, audience);
    if (resolved?.verifiedDomain) {
      const credentialsEnabled = isProviderEnabledForAudience(
        resolved.authConfig,
        audience,
        'credentials',
      );
      return credentialsEnabled && !isSsoEnforced(resolved.authConfig, audience);
    }
  }

  const setup = await loadCompanySetupSettings();
  const { isCredentialsLoginEnabled } = await import('@/lib/company-setup-auth');
  return isCredentialsLoginEnabled(setup, audience);
}

export async function assertOAuthProviderEnabled(
  request: Request,
  audience: OAuthAudience,
  provider: OAuthProviderKey,
): Promise<NextResponse | null> {
  const email = new URL(request.url).searchParams.get('email');
  const enabled = await isOAuthProviderEnabledForLogin(audience, provider, email);
  if (!enabled) {
    return oauthDisabledRedirect(request, audience);
  }
  return null;
}
