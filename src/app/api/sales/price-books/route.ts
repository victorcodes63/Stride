import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import {
  ensureDefaultPriceBook,
  resolvePriceBookUnitPrice,
} from '@/lib/sales/default-price-book';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function mapBook(b: {
  id: string;
  name: string;
  isDefault: boolean;
  currency: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  entries?: Array<{
    id: string;
    productId: string;
    unitPrice: unknown;
    minQty: number;
    product?: { id: string; name: string; sku: string | null } | null;
  }>;
  _count?: { entries: number };
}) {
  return {
    id: b.id,
    name: b.name,
    isDefault: b.isDefault,
    currency: b.currency,
    archivedAt: b.archivedAt?.toISOString() ?? null,
    entryCount: b._count?.entries ?? b.entries?.length,
    entries: b.entries?.map((e) => ({
      id: e.id,
      productId: e.productId,
      product: e.product ?? null,
      unitPrice: Number(e.unitPrice),
      minQty: e.minQty,
    })),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === '1';
    const resolveProductId = request.nextUrl.searchParams.get('resolveProductId')?.trim();
    const resolveQty = Number(request.nextUrl.searchParams.get('qty') ?? '1');
    const resolveBookId = request.nextUrl.searchParams.get('priceBookId')?.trim() || null;

    try {
      if (resolveProductId) {
        const resolved = await ctx.run((tx) =>
          resolvePriceBookUnitPrice(tx, ctx.organizationId, {
            productId: resolveProductId,
            quantity: Number.isFinite(resolveQty) ? resolveQty : 1,
            priceBookId: resolveBookId,
          }),
        );
        return NextResponse.json({ resolved });
      }

      const books = await ctx.run(async (tx) => {
        await ensureDefaultPriceBook(tx, ctx.organizationId);
        return tx.salesPriceBook.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(includeArchived ? {} : { archivedAt: null }),
          },
          include: {
            _count: { select: { entries: true } },
            entries: {
              include: { product: { select: { id: true, name: true, sku: true } } },
              orderBy: [{ productId: 'asc' }, { minQty: 'asc' }],
            },
          },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
      });

      return NextResponse.json({ priceBooks: books.map(mapBook) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/price-books',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load price books.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
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
      const currency =
        typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
      const makeDefault = body.isDefault === true;

      try {
        const book = await withTenantAudit(
          ctx,
          {
            action: 'sales.price_book.create',
            entityType: 'SalesPriceBook',
            route: '/api/sales/price-books',
            entityIdFromResult: (r) => r.id,
          },
          async (tx) => {
            if (makeDefault) {
              await tx.salesPriceBook.updateMany({
                where: { organizationId: ctx.organizationId, isDefault: true },
                data: { isDefault: false },
              });
            }
            return tx.salesPriceBook.create({
              data: {
                organizationId: ctx.organizationId,
                name,
                currency,
                isDefault: makeDefault,
              },
              include: { _count: { select: { entries: true } }, entries: true },
            });
          },
        );
        return NextResponse.json({ priceBook: mapBook(book) }, { status: 201 });
      } catch (error) {
        await reportApiError({
          route: 'POST /api/sales/price-books',
          message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: 'Failed to create price book.' }, { status: 500 });
      }
    },
    { permission: 'sales.admin' },
  );
}
