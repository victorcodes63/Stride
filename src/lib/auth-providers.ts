/**
 * Staff SSO provider availability — server-side only (secrets stay off the client).
 */

export type OAuthProviderKey = 'microsoft' | 'google';

export type OAuthProviderStatus = {
  key: OAuthProviderKey;
  label: string;
  configured: boolean;
  startPath: string;
};

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export function isMicrosoftOAuthConfigured(): boolean {
  return Boolean(trimEnv('MS_CLIENT_ID') && trimEnv('MS_CLIENT_SECRET'));
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(trimEnv('GOOGLE_CLIENT_ID') && trimEnv('GOOGLE_CLIENT_SECRET'));
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
