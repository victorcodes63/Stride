import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  unitPrice: Prisma.Decimal;
  currency: string;
  isRecurring: boolean;
  defaultTermMonths: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { dealLineItems: number; quoteLineItems: number };
};

function mapProduct(p: ProductRow) {
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

      return NextResponse.json({ products: products.map(mapProduct) });
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
    const currency =
      typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
    const isRecurring = body.isRecurring === true;
    const rawTerm = Number(body.defaultTermMonths);
    const defaultTermMonths =
      body.defaultTermMonths != null && Number.isFinite(rawTerm) && rawTerm > 0
        ? Math.round(rawTerm)
        : null;
    const active = body.active === undefined ? true : body.active === true;

    try {
      const product = await ctx.run((tx) =>
        tx.salesProduct.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            sku,
            category,
            description,
            unitPrice,
            currency,
            isRecurring,
            defaultTermMonths: isRecurring ? defaultTermMonths : null,
            active,
          },
          include: { _count: { select: { dealLineItems: true, quoteLineItems: true } } },
        }),
      );

      return NextResponse.json({ product: mapProduct(product) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/products',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create product.' }, { status: 500 });
    }
  });
}
