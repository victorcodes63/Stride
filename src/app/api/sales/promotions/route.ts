import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    try {
      const promotions = await ctx.run((tx) =>
        tx.salesPromotion.findMany({
          where: { organizationId: ctx.organizationId },
          include: { _count: { select: { claims: true } } },
          orderBy: { startsOn: 'desc' },
        }),
      );
      return NextResponse.json({
        promotions: promotions.map((p) => ({
          id: p.id,
          name: p.name,
          mechanic: p.mechanic,
          fundingPct: Number(p.fundingPct),
          discountPct: Number(p.discountPct),
          startsOn: p.startsOn.toISOString().slice(0, 10),
          endsOn: p.endsOn.toISOString().slice(0, 10),
          active: p.active,
          claimCount: p._count.claims,
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/promotions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load promotions.' }, { status: 500 });
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
    if (!name) return NextResponse.json({ error: 'name required.' }, { status: 400 });
    try {
      const promo = await ctx.run((tx) =>
        tx.salesPromotion.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            mechanic: typeof body.mechanic === 'string' ? body.mechanic : 'off_invoice',
            fundingPct: new Prisma.Decimal(Number(body.fundingPct) || 0),
            discountPct: new Prisma.Decimal(Number(body.discountPct) || 0),
            startsOn: new Date(String(body.startsOn || new Date().toISOString())),
            endsOn: new Date(String(body.endsOn || new Date().toISOString())),
            active: body.active !== false,
          },
        }),
      );
      return NextResponse.json({ promotion: { id: promo.id, name: promo.name } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/promotions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create promotion.' }, { status: 500 });
    }
  });
}
