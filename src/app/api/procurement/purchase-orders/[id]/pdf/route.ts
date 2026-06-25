import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { buildLpoPdf } from '@/lib/procurement/lpo-pdf';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  const { id } = await params;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.purchaseOrder.findFirst({
      where: { id, outsourcingClientId: clientId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        vendor: { select: { name: true } },
        client: { select: { name: true } },
        purchaseRequest: { select: { requestNumber: true } },
      },
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const pdf = await buildLpoPdf({
      lpoNumber: row.lpoNumber,
      title: row.title,
      clientName: row.client.name,
      vendorName: row.vendor.name,
      currency: row.currency,
      status: row.status,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      purchaseRequestNumber: row.purchaseRequest?.requestNumber ?? null,
      lines: row.lines.map((line) => ({
        item: line.item,
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${row.lpoNumber}.pdf"`,
      },
    });
  } catch (error) {
    await reportApiError({
      route: `GET /api/procurement/purchase-orders/${id}/pdf`,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate LPO PDF.' }, { status: 500 });
  }
}
