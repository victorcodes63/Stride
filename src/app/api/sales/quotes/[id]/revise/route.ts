import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/sales/quotes/[id]/revise — clone as version+1; mark prior superseded (B3).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    try {
      const result = await ctx.run(async (tx) => {
        const source = await tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!source) return { kind: 'not_found' as const };
        if (source.supersededById) {
          return { kind: 'already_superseded' as const };
        }

        const nextVersion = source.version + 1;
        const clone = await tx.salesQuote.create({
          data: {
            organizationId: ctx.organizationId,
            quoteNumber: source.quoteNumber,
            version: nextVersion,
            dealId: source.dealId,
            accountsClientId: source.accountsClientId,
            title: source.title,
            status: 'draft',
            currency: source.currency,
            issueDate: new Date(),
            validUntil: source.validUntil,
            discountPct: source.discountPct,
            taxRateBps: source.taxRateBps,
            notes: source.notes,
            terms: source.terms,
            createdByUserId: ctx.staff.id,
            lineItems: {
              create: source.lineItems.map((li) => ({
                organizationId: ctx.organizationId,
                productId: li.productId,
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                discountPct: li.discountPct,
                priceOverridden: li.priceOverridden,
                isRecurring: li.isRecurring,
                termMonths: li.termMonths,
                sortOrder: li.sortOrder,
              })),
            },
          },
          select: { id: true, quoteNumber: true, version: true },
        });

        await tx.salesQuote.update({
          where: { id: source.id },
          data: { supersededById: clone.id },
        });

        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId,
            actorUserId: ctx.staff.id,
            actorEmail: ctx.staff.email,
            action: 'sales.quote.revised',
            entityType: 'SalesQuote',
            entityId: clone.id,
            route: `/api/sales/quotes/${id}/revise`,
            metadata: {
              priorQuoteId: source.id,
              quoteNumber: source.quoteNumber,
              fromVersion: source.version,
              toVersion: nextVersion,
            },
          },
        });

        return { kind: 'ok' as const, quote: clone, priorId: source.id };
      });

      if (result.kind === 'not_found') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (result.kind === 'already_superseded') {
        return NextResponse.json(
          { error: 'This quote was already revised. Open the latest version instead.' },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          quote: result.quote,
          priorQuoteId: result.priorId,
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/quotes/[id]/revise',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to revise quote.' }, { status: 500 });
    }
  });
}
