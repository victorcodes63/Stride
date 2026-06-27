import { loadCompanySetupSettings } from '@/lib/company-setup';
import { isCredentialsLoginEnabled, type PortalAudience } from '@/lib/company-setup-auth';
import { NextResponse } from 'next/server';

export async function assertCredentialsLoginEnabled(
  audience: PortalAudience,
): Promise<NextResponse | null> {
  const setup = await loadCompanySetupSettings();
  if (!isCredentialsLoginEnabled(setup, audience)) {
    return NextResponse.json(
      {
        error:
          audience === 'ess'
            ? 'Email and password sign-in is disabled. Use your organisation SSO button instead.'
            : 'Email and password sign-in is disabled. Use your organisation SSO button instead.',
      },
      { status: 403 },
    );
  }
  return null;
}
