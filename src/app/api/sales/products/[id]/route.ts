import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { canViewSalesMargin } from '@/lib/sales/access';
import { afterProductWrite, mapProductToJson } from '@/lib/sales/product-api';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    const includeCost = await canViewSalesMargin(ctx.staff);
    try {
      const product = await ctx.run((tx) =>
        tx.salesProduct.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: { _count: { select: { dealLineItems: true, quoteLineItems: true } } },
        }),
      );
      if (!product) {
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
      }
      return NextResponse.json({ product: mapProductToJson(product, { includeCost }) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/products/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load product.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const includeCost = await canViewSalesMargin(ctx.staff);

    try {
      const updated = await withTenantAudit(
        ctx,
        {
          action: 'sales.product.update',
          entityType: 'SalesProduct',
          entityId: id,
          route: `/api/sales/products/${id}`,
          entityIdFromResult: (r) => r?.id,
        },
        async (tx) => {
          const existing = await tx.salesProduct.findFirst({
            where: { id, organizationId: ctx.organizationId },
          });
          if (!existing) return null;

          const data: Prisma.SalesProductUncheckedUpdateInput = {};
          if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
          if ('sku' in body)
            data.sku = typeof body.sku === 'string' ? body.sku.trim() || null : null;
          if ('category' in body)
            data.category = typeof body.category === 'string' ? body.category.trim() || null : null;
          if ('description' in body)
            data.description =
              typeof body.description === 'string' ? body.description.trim() || null : null;
          if ('unit' in body)
            data.unit = typeof body.unit === 'string' ? body.unit.trim() || null : null;
          if (typeof body.currency === 'string' && body.currency.trim())
            data.currency = body.currency.trim();
          if ('unitPrice' in body) {
            const p = Number(body.unitPrice);
            if (Number.isFinite(p) && p >= 0) data.unitPrice = p;
          }
          if ('costPrice' in body) {
            if (body.costPrice == null || body.costPrice === '') {
              data.costPrice = null;
            } else {
              const c = Number(body.costPrice);
              if (Number.isFinite(c) && c >= 0) data.costPrice = c;
            }
          }
          if ('isRecurring' in body) data.isRecurring = body.isRecurring === true;
          if ('defaultTermMonths' in body) {
            const t = Number(body.defaultTermMonths);
            data.defaultTermMonths =
              body.defaultTermMonths != null && Number.isFinite(t) && t > 0 ? Math.round(t) : null;
          }
          if ('active' in body) data.active = body.active === true;

          const willBeRecurring =
            'isRecurring' in body ? body.isRecurring === true : existing.isRecurring;
          if (!willBeRecurring) data.defaultTermMonths = null;

          const product = await tx.salesProduct.update({
            where: { id },
            data,
            include: { _count: { select: { dealLineItems: true, quoteLineItems: true } } },
          });
          if ('unitPrice' in body || 'currency' in body) {
            await afterProductWrite(tx, ctx.organizationId, product);
          }
          return product;
        },
      );

      if (!updated) {
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
      }
      return NextResponse.json({ product: mapProductToJson(updated, { includeCost }) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/products/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update product.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.salesProduct.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: { _count: { select: { dealLineItems: true, quoteLineItems: true } } },
        });
        if (!existing) return { status: 'not_found' as const };

        const inUse = existing._count.dealLineItems + existing._count.quoteLineItems > 0;
        if (inUse) {
          if (!existing.active) {
            return { status: 'deactivated' as const, alreadyInactive: true };
          }
          await tx.salesProduct.update({ where: { id }, data: { active: false } });
          return { status: 'deactivated' as const, alreadyInactive: false };
        }

        await tx.salesProduct.delete({ where: { id } });
        return { status: 'deleted' as const };
      });

      if (result.status === 'not_found') {
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
      }
      if (result.status === 'deactivated') {
        return NextResponse.json({
          ok: true,
          id,
          softDeactivated: true,
          message:
            'Product is referenced by existing documents, so it was deactivated instead of deleted.',
        });
      }
      return NextResponse.json({ ok: true, id, deleted: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/sales/products/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete product.' }, { status: 500 });
    }
  });
}
