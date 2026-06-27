/**
 * Stride platform OAuth — ONE shared Microsoft Entra app (multi-tenant /common)
 * and ONE Google OAuth app for all tenants. Client secrets live here once;
 * per-company auth policy is in OrganizationAuthConfig (see org-auth-config.ts).
 *
 * Auth.js mapping: AzureAD provider + Google provider options exported below
 * for a future next-auth migration; current routes use these credentials directly.
 */

import type { OAuthAudience } from '@/lib/oauth-utils';
import { getOAuthRedirectUri } from '@/lib/oauth-utils';

/** Multi-tenant work/school — never a single-customer tenant id for sign-in. */
export const STRIDE_MS_OAUTH_TENANT = 'common';

const MS_SCOPES = 'openid profile email User.Read';
const GOOGLE_SCOPES = 'openid email profile';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = trimEnv(key);
    if (v) return v;
  }
  return undefined;
}

export type PlatformOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

export function getStrideMicrosoftOAuthCredentials(): PlatformOAuthCredentials | null {
  const clientId = firstEnv('STRIDE_MS_CLIENT_ID', 'MS_CLIENT_ID');
  const clientSecret = firstEnv('STRIDE_MS_CLIENT_SECRET', 'MS_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getStrideGoogleOAuthCredentials(): PlatformOAuthCredentials | null {
  const clientId = firstEnv('STRIDE_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID');
  const clientSecret = firstEnv('STRIDE_GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isStrideMicrosoftOAuthConfigured(): boolean {
  return getStrideMicrosoftOAuthCredentials() !== null;
}

export function isStrideGoogleOAuthConfigured(): boolean {
  return getStrideGoogleOAuthCredentials() !== null;
}

export function getMicrosoftOAuthTokenEndpoint(): string {
  return `https://login.microsoftonline.com/${STRIDE_MS_OAUTH_TENANT}/oauth2/v2.0/token`;
}

export function getMicrosoftOAuthAuthorizeEndpoint(): string {
  return `https://login.microsoftonline.com/${STRIDE_MS_OAUTH_TENANT}/oauth2/v2.0/authorize`;
}

export function getMicrosoftOAuthRedirectUri(
  audience: OAuthAudience,
  envOverride?: string,
): string {
  if (envOverride?.trim()) return envOverride.trim();
  const platformOverride =
    audience === 'staff'
      ? trimEnv('STRIDE_MS_REDIRECT_URI') ?? trimEnv('MS_REDIRECT_URI')
      : trimEnv('STRIDE_ESS_MS_REDIRECT_URI') ?? trimEnv('ESS_MS_REDIRECT_URI');
  return getOAuthRedirectUri(audience, 'microsoft', platformOverride);
}

export function getGoogleOAuthRedirectUri(
  audience: OAuthAudience,
  envOverride?: string,
): string {
  if (envOverride?.trim()) return envOverride.trim();
  const platformOverride =
    audience === 'staff'
      ? trimEnv('STRIDE_GOOGLE_REDIRECT_URI') ?? trimEnv('GOOGLE_REDIRECT_URI')
      : trimEnv('STRIDE_ESS_GOOGLE_REDIRECT_URI') ?? trimEnv('ESS_GOOGLE_REDIRECT_URI');
  return getOAuthRedirectUri(audience, 'google', platformOverride);
}

export function buildMicrosoftAuthorizeUrl(input: {
  audience: OAuthAudience;
  state: string;
  loginHint?: string;
}): URL | null {
  const creds = getStrideMicrosoftOAuthCredentials();
  if (!creds) return null;

  const authUrl = new URL(getMicrosoftOAuthAuthorizeEndpoint());
  authUrl.searchParams.set('client_id', creds.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', getMicrosoftOAuthRedirectUri(input.audience));
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', MS_SCOPES);
  authUrl.searchParams.set('state', input.state);
  authUrl.searchParams.set('prompt', 'select_account');
  if (input.loginHint) {
    authUrl.searchParams.set('login_hint', input.loginHint);
  }
  return authUrl;
}

export function buildGoogleAuthorizeUrl(input: {
  audience: OAuthAudience;
  state: string;
  loginHint?: string;
  hostedDomain?: string;
}): URL | null {
  const creds = getStrideGoogleOAuthCredentials();
  if (!creds) return null;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', creds.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', getGoogleOAuthRedirectUri(input.audience));
  authUrl.searchParams.set('scope', GOOGLE_SCOPES);
  authUrl.searchParams.set('state', input.state);
  authUrl.searchParams.set('prompt', 'select_account');
  if (input.loginHint) {
    authUrl.searchParams.set('login_hint', input.loginHint);
  }
  if (input.hostedDomain) {
    authUrl.searchParams.set('hd', input.hostedDomain);
  }
  return authUrl;
}

/** Auth.js v5 provider option shapes — scaffold for future migration. */
export function getAuthJsProviderScaffold() {
  const ms = getStrideMicrosoftOAuthCredentials();
  const google = getStrideGoogleOAuthCredentials();
  return {
    microsoft: ms
      ? {
          id: 'microsoft',
          name: 'Microsoft',
          type: 'oidc' as const,
          issuer: `https://login.microsoftonline.com/${STRIDE_MS_OAUTH_TENANT}/v2.0`,
          clientId: ms.clientId,
          clientSecret: ms.clientSecret,
          authorization: { params: { scope: MS_SCOPES } },
        }
      : null,
    google: google
      ? {
          id: 'google',
          name: 'Google',
          type: 'oidc' as const,
          clientId: google.clientId,
          clientSecret: google.clientSecret,
          authorization: { params: { scope: GOOGLE_SCOPES, prompt: 'select_account' } },
        }
      : null,
  };
}
