import { NextRequest, NextResponse } from 'next/server';
import {
  isStrideGoogleOAuthConfigured,
  isStrideMicrosoftOAuthConfigured,
} from '@/lib/auth/platform-oauth';
import {
  pickPrimaryAuthMethod,
  resolveOrgByEmail,
} from '@/lib/auth/resolve-org-by-email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid work email.' }, { status: 400 });
    }

    const resolved = await resolveOrgByEmail(email, 'staff');
    if (!resolved) {
      return NextResponse.json(
        { error: 'We could not find an organization for that email domain.' },
        { status: 404 },
      );
    }

    const authMethod = pickPrimaryAuthMethod(resolved, 'staff');
    const msConfigured = isStrideMicrosoftOAuthConfigured();
    const googleConfigured = isStrideGoogleOAuthConfigured();

    const showMicrosoft =
      authMethod === 'microsoft' &&
      msConfigured &&
      resolved.authConfig.staffEnabledProviders.includes('microsoft');
    const showGoogle =
      authMethod === 'google' &&
      googleConfigured &&
      resolved.authConfig.staffEnabledProviders.includes('google');
    const showCredentials = resolved.credentialsAllowed;

    return NextResponse.json({
      email,
      organizationName: resolved.organizationName,
      organizationSlug: resolved.organizationSlug,
      verifiedDomain: resolved.verifiedDomain,
      authMethod,
      showMicrosoft,
      showGoogle,
      showCredentials,
      ssoEnforced: resolved.authConfig.ssoEnforcedStaff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to resolve organization.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
