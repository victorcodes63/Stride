import { NextRequest, NextResponse } from 'next/server';
import type { ConstructionSubcontractorStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessConstruction, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeSubcontractor } from '@/lib/construction/serialize';

const SUB_STATUSES = new Set<ConstructionSubcontractorStatus>(['active', 'on_hold', 'completed']);

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessConstruction(user)) {
    return forbiddenResponse('Construction access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const subcontractors = await prisma.constructionSubcontractor.findMany({
      where: { outsourcingClientId: clientId },
      include: { site: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({
      subcontractors: subcontractors.map(serializeSubcontractor),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/construction/subcontractors',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load subcontractors.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessConstruction(user)) {
    return forbiddenResponse('Construction access is restricted to operations and admin users.');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  }

  const status =
    typeof body.status === 'string' && SUB_STATUSES.has(body.status as ConstructionSubcontractorStatus)
      ? (body.status as ConstructionSubcontractorStatus)
      : 'active';

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.constructionSubcontractor.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        siteId: typeof body.siteId === 'string' ? body.siteId : null,
        name,
        trade: typeof body.trade === 'string' ? body.trade.trim() : null,
        contactName: typeof body.contactName === 'string' ? body.contactName.trim() : null,
        contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() : null,
        retentionPct:
          typeof body.retentionPct === 'number'
            ? body.retentionPct
            : body.retentionPct
              ? Number(body.retentionPct)
              : null,
        contractValue:
          typeof body.contractValue === 'number'
            ? body.contractValue
            : body.contractValue
              ? Number(body.contractValue)
              : null,
        amountInvoiced:
          typeof body.amountInvoiced === 'number'
            ? body.amountInvoiced
            : body.amountInvoiced
              ? Number(body.amountInvoiced)
              : 0,
        amountPaid:
          typeof body.amountPaid === 'number'
            ? body.amountPaid
            : body.amountPaid
              ? Number(body.amountPaid)
              : 0,
        status,
      },
      include: { site: true },
    });
    return NextResponse.json({ subcontractor: serializeSubcontractor(row) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/construction/subcontractors',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create subcontractor.' }, { status: 500 });
  }
}
