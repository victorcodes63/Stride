import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { getOrCreateStock } from '@/lib/inventory/atp';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const { id } = await params;
    try {
      await ctx.run(async (tx) => {
        const load = await tx.salesVanLoad.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: { lines: true },
        });
        if (!load) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        if (load.status !== 'draft') throw Object.assign(new Error('NOT_DRAFT'), { code: 'NOT_DRAFT' });
        for (const line of load.lines) {
          const stock = await getOrCreateStock(tx, {
            organizationId: ctx.organizationId,
            facilitySiteId: load.facilitySiteId,
            productId: line.productId,
          });
          const qty = Number(line.qtyBase);
          if (Number(stock.qtyOnHand) - Number(stock.qtyReserved) < qty) {
            throw Object.assign(new Error('INSUFFICIENT'), { code: 'INSUFFICIENT' });
          }
          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: {
              qtyOnHand: new Prisma.Decimal(Number(stock.qtyOnHand) - qty),
            },
          });
          await tx.inventoryMovement.create({
            data: {
              organizationId: ctx.organizationId,
              facilitySiteId: load.facilitySiteId,
              productId: line.productId,
              type: 'issue',
              qtyBase: new Prisma.Decimal(qty),
              referenceType: 'van_load',
              referenceId: load.id,
              createdByUserId: ctx.staff.id,
            },
          });
        }
        await tx.salesVanLoad.update({ where: { id: load.id }, data: { status: 'issued' } });
      });
      return NextResponse.json({ ok: true });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'NOT_FOUND') return NextResponse.json({ error: 'Van load not found.' }, { status: 404 });
      if (err.code === 'INSUFFICIENT') return NextResponse.json({ error: 'Insufficient stock to issue.' }, { status: 409 });
      await reportApiError({
        route: 'POST /api/sales/van-loads/[id]/issue',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to issue van load.' }, { status: 500 });
    }
  });
}
