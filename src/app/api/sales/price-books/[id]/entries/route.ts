import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function mapEntry(e: {
  id: string;
  productId: string;
  unitPrice: unknown;
  minQty: number;
  product?: { id: string; name: string; sku: string | null } | null;
}) {
  return {
    id: e.id,
    productId: e.productId,
    product: e.product ?? null,
    unitPrice: Number(e.unitPrice),
    minQty: e.minQty,
  };
}

/** Create or upsert a volume-tier entry on a price book. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(
    request,
    async (ctx) => {
      const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
      if (moduleBlock) return moduleBlock;

      const { id: priceBookId } = await params;
      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }

      const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
      const unitPrice = Number(body.unitPrice);
      const minQtyRaw = Number(body.minQty);
      const minQty =
        Number.isFinite(minQtyRaw) && minQtyRaw >= 1 ? Math.floor(minQtyRaw) : 1;

      if (!productId || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json(
          { error: 'productId and non-negative unitPrice are required.' },
          { status: 400 },
        );
      }

      try {
        const entry = await withTenantAudit(
          ctx,
          {
            action: 'sales.price_book.entry.upsert',
            entityType: 'SalesPriceBookEntry',
            route: `/api/sales/price-books/${priceBookId}/entries`,
            entityIdFromResult: (r) => r.id,
            metadata: { priceBookId, productId, minQty },
          },
          async (tx) => {
            const book = await tx.salesPriceBook.findFirst({
              where: { id: priceBookId, organizationId: ctx.organizationId, archivedAt: null },
            });
            if (!book) throw Object.assign(new Error('BOOK_NOT_FOUND'), { code: 'BOOK_NOT_FOUND' });

            const product = await tx.salesProduct.findFirst({
              where: { id: productId, organizationId: ctx.organizationId },
              select: { id: true },
            });
            if (!product) {
              throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { code: 'PRODUCT_NOT_FOUND' });
            }

            const existing = await tx.salesPriceBookEntry.findFirst({
              where: { priceBookId, productId, minQty },
            });
            if (existing) {
              return tx.salesPriceBookEntry.update({
                where: { id: existing.id },
                data: { unitPrice },
                include: { product: { select: { id: true, name: true, sku: true } } },
              });
            }
            return tx.salesPriceBookEntry.create({
              data: {
                organizationId: ctx.organizationId,
                priceBookId,
                productId,
                unitPrice,
                minQty,
              },
              include: { product: { select: { id: true, name: true, sku: true } } },
            });
          },
        );

        return NextResponse.json({ entry: mapEntry(entry) }, { status: 201 });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'BOOK_NOT_FOUND') {
          return NextResponse.json({ error: 'Price book not found.' }, { status: 404 });
        }
        if (code === 'PRODUCT_NOT_FOUND') {
          return NextResponse.json({ error: 'Product not found.' }, { status: 400 });
        }
        await reportApiError({
          route: 'POST /api/sales/price-books/[id]/entries',
          message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: 'Failed to save price entry.' }, { status: 500 });
      }
    },
    { permission: 'sales.admin' },
  );
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withTenant(
    request,
    async (ctx) => {
      const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
      if (moduleBlock) return moduleBlock;

      const { id: priceBookId } = await params;
      const entryId = request.nextUrl.searchParams.get('entryId')?.trim();
      if (!entryId) {
        return NextResponse.json({ error: 'entryId is required.' }, { status: 400 });
      }

      try {
        const deleted = await withTenantAudit(
          ctx,
          {
            action: 'sales.price_book.entry.delete',
            entityType: 'SalesPriceBookEntry',
            entityId: entryId,
            route: `/api/sales/price-books/${priceBookId}/entries`,
          },
          async (tx) => {
            const existing = await tx.salesPriceBookEntry.findFirst({
              where: { id: entryId, priceBookId, organizationId: ctx.organizationId },
            });
            if (!existing) return null;
            await tx.salesPriceBookEntry.delete({ where: { id: entryId } });
            return existing;
          },
        );
        if (!deleted) {
          return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
        }
        return NextResponse.json({ ok: true, id: entryId });
      } catch (error) {
        await reportApiError({
          route: 'DELETE /api/sales/price-books/[id]/entries',
          message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: 'Failed to delete entry.' }, { status: 500 });
      }
    },
    { permission: 'sales.admin' },
  );
}
