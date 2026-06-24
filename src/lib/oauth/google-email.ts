import { getOAuthRedirectUri, normalizeOAuthEmail, type OAuthAudience } from '@/lib/oauth-utils';

const GOOGLE_DEBUG = process.env.GOOGLE_OAUTH_DEBUG === 'true';

function log(step: string, details: Record<string, unknown>) {
  if (!GOOGLE_DEBUG) return;
  console.info(`[GOOGLE_OAUTH] ${step}`, details);
}

export async function exchangeGoogleCodeForEmail(
  code: string,
  audience: OAuthAudience,
): Promise<{ email: string } | { error: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = getOAuthRedirectUri(
    audience,
    'google',
    audience === 'staff' ? process.env.GOOGLE_REDIRECT_URI : process.env.ESS_GOOGLE_REDIRECT_URI,
  );

  if (!clientId || !clientSecret) {
    return { error: 'Google OAuth is not configured.' };
  }

  log('token_exchange_start', { audience, redirectUri });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    log('token_exchange_failed', { status: tokenRes.status, body: body.slice(0, 300) });
    return { error: 'Google token exchange failed.' };
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) return { error: 'Google token response missing access token.' };

  const meRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!meRes.ok) {
    return { error: 'Google profile lookup failed.' };
  }

  const me = (await meRes.json()) as { email?: string | null };
  const email = normalizeOAuthEmail(me.email || '');
  if (!email) return { error: 'Google account has no usable email.' };

  return { email };
}
