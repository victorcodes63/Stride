import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { convertAcceptedQuoteToInvoice } from '@/lib/sales-finance-bridge';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Convert an accepted quote into a Finance AccountsInvoice (B4 bridge).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const converted = await convertAcceptedQuoteToInvoice(tx, {
          organizationId: ctx.organizationId,
          quoteId: id,
        });
        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId,
            actorUserId: ctx.staff.id,
            actorEmail: ctx.staff.email,
            action: 'sales.quote.converted_to_invoice',
            entityType: 'SalesQuote',
            entityId: id,
            route: `/api/sales/quotes/${id}/convert-to-invoice`,
            metadata: {
              accountsInvoiceId: converted.accountsInvoiceId,
              invoiceNumber: converted.invoiceNumber,
              alreadyLinked: converted.alreadyLinked ?? false,
            },
          },
        });
        return converted;
      });

      return NextResponse.json({ result }, { status: result.alreadyLinked ? 200 : 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'QUOTE_NOT_FOUND') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (err.code === 'ALREADY_INVOICED') {
        return NextResponse.json(
          { error: 'This quote has already been converted to an invoice.' },
          { status: 409 },
        );
      }
      if (err.code === 'QUOTE_NOT_ACCEPTED') {
        return NextResponse.json(
          { error: 'Only accepted quotes can be converted to an invoice.' },
          { status: 400 },
        );
      }
      if (err.code === 'QUOTE_SUPERSEDED') {
        return NextResponse.json(
          { error: 'This quote revision was superseded — convert the current version instead.' },
          { status: 400 },
        );
      }
      if (err.code === 'CLIENT_REQUIRED') {
        return NextResponse.json(
          { error: 'Attach a billing client to the quote before invoicing.' },
          { status: 400 },
        );
      }
      if (err.code === 'NO_BILLABLE_LINES') {
        return NextResponse.json(
          { error: 'The quote must have at least one line item to invoice.' },
          { status: 400 },
        );
      }
      await reportApiError({
        route: 'POST /api/sales/quotes/[id]/convert-to-invoice',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to convert quote to invoice.' }, { status: 500 });
    }
  });
}
