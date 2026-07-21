import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { hasSalesQuoteApproveAccess } from '@/lib/sales/access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales/quotes/approvals — pending quote approvals inbox (B2).
 * Visible to holders of sales.approve_quotes (via hasSalesQuoteApproveAccess).
 *
 * TODO(Phase C): filter inbox to the deal owner's team leader instead of any approver.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    if (!(await hasSalesQuoteApproveAccess(ctx.staff))) {
      return NextResponse.json({ error: 'Missing permission: sales.approve_quotes' }, { status: 403 });
    }

    try {
      const rows = await ctx.run((tx) =>
        tx.salesQuoteApproval.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'pending',
          },
          include: {
            quote: {
              select: {
                id: true,
                quoteNumber: true,
                title: true,
                status: true,
                currency: true,
                discountPct: true,
                accountsClient: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
              },
            },
            requestedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
        }),
      );

      return NextResponse.json({
        approvals: rows.map((row) => ({
          id: row.id,
          status: row.status,
          effectiveDiscountPct:
            row.effectiveDiscountPct != null ? Number(row.effectiveDiscountPct) : null,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
          quote: row.quote
            ? {
                id: row.quote.id,
                quoteNumber: row.quote.quoteNumber,
                title: row.quote.title,
                status: row.quote.status,
                currency: row.quote.currency,
                discountPct: Number(row.quote.discountPct),
                accountsClient: row.quote.accountsClient,
                createdBy: row.quote.createdBy
                  ? {
                      id: row.quote.createdBy.id,
                      name: row.quote.createdBy.name,
                    }
                  : null,
              }
            : null,
          requestedBy: {
            id: row.requestedBy.id,
            name: row.requestedBy.name,
            email: row.requestedBy.email,
          },
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/quotes/approvals',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load approvals.' }, { status: 500 });
    }
  });
}
