import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { canViewSalesMargin } from '@/lib/sales/access';
import { afterProductWrite, mapProductToJson } from '@/lib/sales/product-api';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const params = request.nextUrl.searchParams;
    const q = params.get('q')?.trim() || undefined;
    const category = params.get('category')?.trim() || undefined;
    const activeParam = params.get('active')?.trim().toLowerCase();
    const active =
      activeParam === 'true' ? true : activeParam === 'false' ? false : undefined;
    const includeCost = await canViewSalesMargin(ctx.staff);

    try {
      const products = await ctx.run((tx) =>
        tx.salesProduct.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(active !== undefined ? { active } : {}),
            ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { sku: { contains: q, mode: 'insensitive' } },
                    { category: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            _count: { select: { dealLineItems: true, quoteLineItems: true } },
          },
          orderBy: [{ active: 'desc' }, { name: 'asc' }],
          take: 500,
        }),
      );

      return NextResponse.json({
        products: products.map((p) => mapProductToJson(p, { includeCost })),
        canViewMargin: includeCost,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/products',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load products.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

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

    const rawPrice = Number(body.unitPrice);
    const unitPrice = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    const sku = typeof body.sku === 'string' ? body.sku.trim() || null : null;
    const category = typeof body.category === 'string' ? body.category.trim() || null : null;
    const description =
      typeof body.description === 'string' ? body.description.trim() || null : null;
    const unit = typeof body.unit === 'string' ? body.unit.trim() || null : null;
    let costPrice: number | null = null;
    if ('costPrice' in body && body.costPrice != null && body.costPrice !== '') {
      const c = Number(body.costPrice);
      if (!Number.isFinite(c) || c < 0) {
        return NextResponse.json({ error: 'costPrice must be a non-negative number.' }, { status: 400 });
      }
      costPrice = c;
    }
    const currency =
      typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
    const isRecurring = body.isRecurring === true;
    const rawTerm = Number(body.defaultTermMonths);
    const defaultTermMonths =
      body.defaultTermMonths != null && Number.isFinite(rawTerm) && rawTerm > 0
        ? Math.round(rawTerm)
        : null;
    const active = body.active === undefined ? true : body.active === true;
    const includeCost = await canViewSalesMargin(ctx.staff);

    try {
      const product = await withTenantAudit(
        ctx,
        {
          action: 'sales.product.create',
          entityType: 'SalesProduct',
          route: '/api/sales/products',
          entityIdFromResult: (r) => r.id,
        },
        async (tx) => {
          const created = await tx.salesProduct.create({
            data: {
              organizationId: ctx.organizationId,
              name,
              sku,
              category,
              description,
              unitPrice,
              costPrice,
              unit,
              currency,
              isRecurring,
              defaultTermMonths: isRecurring ? defaultTermMonths : null,
              active,
            },
            include: { _count: { select: { dealLineItems: true, quoteLineItems: true } } },
          });
          await afterProductWrite(tx, ctx.organizationId, created);
          return created;
        },
      );

      return NextResponse.json(
        { product: mapProductToJson(product, { includeCost }) },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/products',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create product.' }, { status: 500 });
    }
  });
}
