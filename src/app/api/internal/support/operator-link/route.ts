import { NextRequest, NextResponse } from 'next/server';
import { verifyCellProvisionAuth, unauthorizedProvisionResponse } from '@/lib/cell-provision-auth';
import {
  buildSupportOperatorDashboardUrl,
  mintSupportOperatorToken,
  randomSupportAuditId,
} from '@/lib/support-operator-session';
import { withOrgContext } from '@/lib/org-context';

export const dynamic = 'force-dynamic';

type Body = {
  organizationId?: string;
  operatorEmail?: string;
  operatorName?: string;
  customerSlug?: string;
};

/** POST /api/internal/support/operator-link — audited CP operator view-as link (CP-22). */
export async function POST(request: NextRequest) {
  if (!verifyCellProvisionAuth(request)) {
    return unauthorizedProvisionResponse();
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  const operatorEmail = typeof body.operatorEmail === 'string' ? body.operatorEmail.trim() : '';
  const operatorName = typeof body.operatorName === 'string' ? body.operatorName.trim() : 'Stride operator';
  const customerSlug = typeof body.customerSlug === 'string' ? body.customerSlug.trim() : '';

  if (!organizationId || !operatorEmail || !customerSlug) {
    return NextResponse.json(
      { error: 'organizationId, operatorEmail, and customerSlug are required.' },
      { status: 400 },
    );
  }

  const minted = mintSupportOperatorToken({
    organizationId,
    operatorEmail,
    operatorName,
    customerSlug,
  });
  if (!minted) {
    return NextResponse.json(
      { error: 'STRIDE_CELL_PROVISION_KEY is not configured on this cell.' },
      { status: 503 },
    );
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!base) {
    return NextResponse.json({ error: 'App base URL is not configured.' }, { status: 503 });
  }

  const auditId = randomSupportAuditId();
  try {
    await withOrgContext(organizationId, (tx) =>
      tx.auditEvent.create({
        data: {
          organizationId,
          actorEmail: operatorEmail,
          action: 'support.operator_link_issued',
          entityType: 'Organization',
          entityId: organizationId,
          route: '/api/internal/support/operator-link',
          metadata: {
            auditId,
            customerSlug,
            operatorEmail,
            operatorName,
            expiresAt: minted.expiresAt,
          },
        },
      }),
    );
  } catch {
    // Non-fatal — link still issued; CP also records audit.
  }

  return NextResponse.json({
    url: buildSupportOperatorDashboardUrl(base, minted.token),
    expiresAt: minted.expiresAt,
    auditId,
  });
}
