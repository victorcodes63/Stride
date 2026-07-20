import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function mapProduct(p: {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  unitPrice: unknown;
  currency: string;
  isRecurring: boolean;
  defaultTermMonths: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { dealLineItems: number; quoteLineItems: number };
}) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    description: p.description,
    unitPrice: Number(p.unitPrice),
    currency: p.currency,
    isRecurring: p.isRecurring,
    defaultTermMonths: p.defaultTermMonths,
    active: p.active,
    usageCount: p._count ? p._count.dealLineItems + p._count.quoteLineItems : undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
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
      return NextResponse.json({ product: mapProduct(product) });
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

    try {
      const updated = await ctx.run(async (tx) => {
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
        if (typeof body.currency === 'string' && body.currency.trim())
          data.currency = body.currency.trim();
        if ('unitPrice' in body) {
          const p = Number(body.unitPrice);
          if (Number.isFinite(p) && p >= 0) data.unitPrice = p;
        }
        if ('isRecurring' in body) data.isRecurring = body.isRecurring === true;
        if ('defaultTermMonths' in body) {
          const t = Number(body.defaultTermMonths);
          data.defaultTermMonths =
            body.defaultTermMonths != null && Number.isFinite(t) && t > 0 ? Math.round(t) : null;
        }
        if ('active' in body) data.active = body.active === true;

        // Recurring products only keep a default term when still recurring.
        const willBeRecurring =
          'isRecurring' in body ? body.isRecurring === true : existing.isRecurring;
        if (!willBeRecurring) data.defaultTermMonths = null;

        return tx.salesProduct.update({
          where: { id },
          data,
          include: { _count: { select: { dealLineItems: true, quoteLineItems: true } } },
        });
      });

      if (!updated) {
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
      }
      return NextResponse.json({ product: mapProduct(updated) });
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
          // Referenced by deal/quote line items — soft-deactivate instead of deleting
          // so historical documents keep their pricing context.
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
          message: 'Product is referenced by existing documents, so it was deactivated instead of deleted.',
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
