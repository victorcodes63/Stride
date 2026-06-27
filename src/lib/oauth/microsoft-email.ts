import {
  getMicrosoftOAuthRedirectUri,
  getMicrosoftOAuthTokenEndpoint,
  getStrideMicrosoftOAuthCredentials,
} from '@/lib/auth/platform-oauth';
import { normalizeOAuthEmail, type OAuthAudience } from '@/lib/oauth-utils';

const MS_DEBUG = process.env.MS_OAUTH_DEBUG === 'true';

function log(step: string, details: Record<string, unknown>) {
  if (!MS_DEBUG) return;
  console.info(`[MS_OAUTH] ${step}`, details);
}

export type MicrosoftOAuthProfile = {
  email: string;
  tenantId?: string;
  idp?: string;
};

export async function exchangeMicrosoftCodeForEmail(
  code: string,
  audience: OAuthAudience,
): Promise<MicrosoftOAuthProfile | { error: string }> {
  const creds = getStrideMicrosoftOAuthCredentials();
  const redirectUri = getMicrosoftOAuthRedirectUri(
    audience,
    audience === 'staff' ? process.env.MS_REDIRECT_URI : process.env.ESS_MS_REDIRECT_URI,
  );

  if (!creds) {
    return { error: 'Microsoft OAuth is not configured.' };
  }

  log('token_exchange_start', { audience, redirectUri });

  const tokenRes = await fetch(getMicrosoftOAuthTokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
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

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
  };
  const accessToken = tokenData.access_token;
  if (!accessToken) return { error: 'Microsoft token response missing access token.' };

  let tenantId: string | undefined;
  let idp: string | undefined;
  if (tokenData.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokenData.id_token.split('.')[1] ?? '', 'base64url').toString('utf8'),
      ) as { tid?: string; idp?: string };
      tenantId = payload.tid;
      idp = payload.idp;
    } catch {
      // non-fatal — profile fetch still works
    }
  }

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

  return { email, tenantId, idp };
}
