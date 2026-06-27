import { NextResponse } from 'next/server';

import type { PortalAudience } from '@/lib/company-setup-auth';
import { isCredentialsLoginEnabledForEmail } from '@/lib/oauth/assert-oauth-enabled';

export async function assertCredentialsLoginEnabled(
  audience: PortalAudience,
  email?: string | null,
): Promise<NextResponse | null> {
  const enabled = await isCredentialsLoginEnabledForEmail(audience, email);
  if (!enabled) {
    return NextResponse.json(
      {
        error:
          'Email and password sign-in is disabled. Use your organisation SSO button instead.',
      },
      { status: 403 },
    );
  }
  return null;
}
