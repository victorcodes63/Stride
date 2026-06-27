import { loadCompanySetupSettings } from '@/lib/company-setup';
import { isOAuthProviderActive } from '@/lib/company-setup-auth';
import type { OAuthAudience } from '@/lib/oauth-utils';
import type { OAuthProviderKey } from '@/lib/auth-providers';
import { NextResponse } from 'next/server';

export async function assertOAuthProviderEnabled(
  request: Request,
  audience: OAuthAudience,
  provider: OAuthProviderKey,
): Promise<NextResponse | null> {
  const setup = await loadCompanySetupSettings();
  if (!isOAuthProviderActive(setup, audience, provider)) {
    const loginPath = audience === 'ess' ? '/ess/login' : '/dashboard/login';
    return NextResponse.redirect(new URL(`${loginPath}?error=oauth_disabled`, request.url));
  }
  return null;
}
