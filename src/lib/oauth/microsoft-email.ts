import { getOAuthRedirectUri, normalizeOAuthEmail, type OAuthAudience } from '@/lib/oauth-utils';

const MS_DEBUG = process.env.MS_OAUTH_DEBUG === 'true';

function log(step: string, details: Record<string, unknown>) {
  if (!MS_DEBUG) return;
  console.info(`[MS_OAUTH] ${step}`, details);
}

function getTokenEndpoint() {
  const tenantId = process.env.MS_TENANT_ID?.trim() || 'common';
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

export async function exchangeMicrosoftCodeForEmail(
  code: string,
  audience: OAuthAudience,
): Promise<{ email: string } | { error: string }> {
  const clientId = process.env.MS_CLIENT_ID?.trim();
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim();
  const redirectUri = getOAuthRedirectUri(
    audience,
    'microsoft',
    audience === 'staff' ? process.env.MS_REDIRECT_URI : process.env.ESS_MS_REDIRECT_URI,
  );

  if (!clientId || !clientSecret) {
    return { error: 'Microsoft OAuth is not configured.' };
  }

  log('token_exchange_start', { audience, redirectUri });

  const tokenRes = await fetch(getTokenEndpoint(), {
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
    return { error: 'Microsoft token exchange failed.' };
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) return { error: 'Microsoft token response missing access token.' };

  const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!meRes.ok) {
    return { error: 'Microsoft profile lookup failed.' };
  }

  const me = (await meRes.json()) as { mail?: string | null; userPrincipalName?: string | null };
  const email = normalizeOAuthEmail(me.mail || me.userPrincipalName || '');
  if (!email) return { error: 'Microsoft account has no usable email.' };

  return { email };
}
