export type OAuthAudience = 'staff' | 'ess';

export function getOAuthBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, '')}`;
  }
  return 'http://localhost:3000';
}

export function getOAuthCookieDomain(requestUrl: string): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const host = new URL(requestUrl).hostname.toLowerCase();
  if (host === 'example.com' || host === 'www.example.com') return '.example.com';
  return undefined;
}

export function normalizeOAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getOAuthStartPath(audience: OAuthAudience, provider: 'microsoft' | 'google'): string {
  const base = audience === 'ess' ? '/api/ess/auth' : '/api/auth';
  return `${base}/${provider}/start`;
}

export function getOAuthCallbackPath(audience: OAuthAudience, provider: 'microsoft' | 'google'): string {
  const base = audience === 'ess' ? '/api/ess/auth' : '/api/auth';
  return `${base}/${provider}/callback`;
}

export function getOAuthRedirectUri(
  audience: OAuthAudience,
  provider: 'microsoft' | 'google',
  envOverride?: string,
): string {
  if (envOverride?.trim()) return envOverride.trim();
  return `${getOAuthBaseUrl()}${getOAuthCallbackPath(audience, provider)}`;
}

export function getOAuthLoginPath(audience: OAuthAudience): string {
  return audience === 'ess' ? '/ess/login' : '/dashboard/login';
}

export function getOAuthSuccessPath(audience: OAuthAudience): string {
  return audience === 'ess' ? '/ess' : '/dashboard';
}
