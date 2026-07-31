import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

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
    const promotionId = typeof body.promotionId === 'string' ? body.promotionId : '';
    const accountsClientId = typeof body.accountsClientId === 'string' ? body.accountsClientId : '';
    const amount = Number(body.amount);
    if (!promotionId || !accountsClientId || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'promotionId, accountsClientId, amount required.' }, { status: 400 });
    }
    try {
      const claim = await ctx.run((tx) =>
        tx.salesTradeClaim.create({
          data: {
            organizationId: ctx.organizationId,
            promotionId,
            accountsClientId,
            amount: new Prisma.Decimal(amount),
            status: 'submitted',
            notes: typeof body.notes === 'string' ? body.notes : null,
          },
        }),
      );
      return NextResponse.json({ claim: { id: claim.id, status: claim.status } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/promotions/claims',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create claim.' }, { status: 500 });
    }
  });
}
