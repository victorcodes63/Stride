import { NextRequest, NextResponse } from 'next/server';
import { verifySupportOperatorToken } from '@/lib/support-operator-session';
import { withOrgContext } from '@/lib/org-context';

export const dynamic = 'force-dynamic';

/** GET /api/support/operator-context?token= — validate CP support link (CP-22). */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json({ error: 'token is required.' }, { status: 400 });
  }

  const payload = verifySupportOperatorToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired support token.' }, { status: 401 });
  }

  try {
    await withOrgContext(payload.organizationId, (tx) =>
      tx.auditEvent.create({
        data: {
          organizationId: payload.organizationId,
          actorEmail: payload.operatorEmail,
          action: 'support.operator_context_opened',
          entityType: 'Organization',
          entityId: payload.organizationId,
          route: '/api/support/operator-context',
          metadata: {
            customerSlug: payload.customerSlug,
            operatorName: payload.operatorName,
            expiresAt: new Date(payload.exp).toISOString(),
          },
        },
      }),
    );
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    operatorEmail: payload.operatorEmail,
    operatorName: payload.operatorName,
    customerSlug: payload.customerSlug,
    organizationId: payload.organizationId,
    expiresAt: new Date(payload.exp).toISOString(),
  });
}
