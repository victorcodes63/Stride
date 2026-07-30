import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const { id } = await params;
    try {
      const uoms = await ctx.run((tx) =>
        tx.salesProductUom.findMany({
          where: { organizationId: ctx.organizationId, productId: id },
          orderBy: { uom: 'asc' },
        }),
      );
      return NextResponse.json({
        uoms: uoms.map((u) => ({
          id: u.id,
          uom: u.uom,
          toBaseFactor: Number(u.toBaseFactor),
          isDefaultOrderUom: u.isDefaultOrderUom,
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/products/[id]/uoms',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load UOMs.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const uom = typeof body.uom === 'string' ? body.uom.trim() : '';
    const toBaseFactor = Number(body.toBaseFactor);
    if (!uom || !Number.isFinite(toBaseFactor) || toBaseFactor <= 0) {
      return NextResponse.json({ error: 'uom and toBaseFactor (>0) required.' }, { status: 400 });
    }
    try {
      const row = await ctx.run((tx) =>
        tx.salesProductUom.upsert({
          where: { productId_uom: { productId: id, uom } },
          create: {
            organizationId: ctx.organizationId,
            productId: id,
            uom,
            toBaseFactor: new Prisma.Decimal(toBaseFactor),
            isDefaultOrderUom: body.isDefaultOrderUom === true,
          },
          update: {
            toBaseFactor: new Prisma.Decimal(toBaseFactor),
            isDefaultOrderUom: body.isDefaultOrderUom === true,
          },
        }),
      );
      return NextResponse.json({ uom: { id: row.id, uom: row.uom, toBaseFactor } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/products/[id]/uoms',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to save UOM.' }, { status: 500 });
    }
  });
}
