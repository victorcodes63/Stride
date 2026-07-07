import { NextRequest, NextResponse } from 'next/server';
import { verifySupportOperatorToken } from '@/lib/support-operator-session';

export const dynamic = 'force-dynamic';

/** GET /api/auth/saml/[audience]/start — AUTH-09 enterprise SAML stub. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ audience: string }> },
) {
  const { audience } = await context.params;
  if (audience !== 'staff' && audience !== 'ess') {
    return NextResponse.json({ error: 'Invalid audience.' }, { status: 400 });
  }

  const orgId = request.nextUrl.searchParams.get('org')?.trim();
  return NextResponse.json(
    {
      error: 'SAML sign-in is not yet activated for this deployment.',
      code: 'SAML_NOT_ACTIVATED',
      audience,
      organizationId: orgId ?? null,
      contact: 'Contact Raven Tech Group to enable enterprise SAML (AUTH-09).',
    },
    { status: 501 },
  );
}
