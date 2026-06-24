import { loadCompanySetupSettings } from '@/lib/company-setup';
import type { OAuthAudience } from '@/lib/oauth-utils';
import type { OAuthProviderKey } from '@/lib/auth-providers';
import { NextResponse } from 'next/server';

export async function assertOAuthProviderEnabled(
  request: Request,
  audience: OAuthAudience,
  provider: OAuthProviderKey,
): Promise<NextResponse | null> {
  const setup = await loadCompanySetupSettings();
  const enabled =
    audience === 'ess'
      ? provider === 'microsoft'
        ? setup.essEnableMicrosoftLogin
        : setup.essEnableGoogleLogin
      : provider === 'microsoft'
        ? setup.staffEnableMicrosoftLogin
        : setup.staffEnableGoogleLogin;

  if (!enabled) {
    const loginPath = audience === 'ess' ? '/ess/login' : '/dashboard/login';
    return NextResponse.redirect(new URL(`${loginPath}?error=oauth_disabled`, request.url));
  }
  return null;
}
