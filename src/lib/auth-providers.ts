/**
 * Staff SSO provider availability — server-side only (secrets stay off the client).
 * Credentials come from Stride platform OAuth (STRIDE_* env), not per-tenant secrets.
 */

import {
  isStrideGoogleOAuthConfigured,
  isStrideMicrosoftOAuthConfigured,
} from '@/lib/auth/platform-oauth';

export type OAuthProviderKey = 'microsoft' | 'google';

export type OAuthProviderStatus = {
  key: OAuthProviderKey;
  label: string;
  configured: boolean;
  startPath: string;
};

export function isMicrosoftOAuthConfigured(): boolean {
  return isStrideMicrosoftOAuthConfigured();
}

export function isGoogleOAuthConfigured(): boolean {
  return isStrideGoogleOAuthConfigured();
}

export function listOAuthProviderStatus(): OAuthProviderStatus[] {
  return [
    {
      key: 'microsoft',
      label: 'Microsoft',
      configured: isMicrosoftOAuthConfigured(),
      startPath: '/api/auth/microsoft/start',
    },
    {
      key: 'google',
      label: 'Google',
      configured: isGoogleOAuthConfigured(),
      startPath: '/api/auth/google/start',
    },
  ];
}

export function getAuthProvidersSummary() {
  const providers = listOAuthProviderStatus();
  return {
    providers,
    anyConfigured: providers.some((p) => p.configured),
  };
}
