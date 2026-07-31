import { NextRequest, NextResponse } from 'next/server';
import {
  createDraftAccountsInvoice,
  dueDateFromIssue,
  type BillingLineDraft,
} from '@/lib/accounts/billing-automation';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { lineItemExtendedAmount } from '@/lib/sales/access';
import { evaluateSalesCreditGate } from '@/lib/sales/cross-module-gates';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Convert an accepted quote into a Finance AccountsInvoice.
 *
 * We mirror the deal → invoice flow (`/api/sales/deals/[id]/create-invoice`):
 * the shared `createDraftAccountsInvoice` helper handles org scoping, the global
 * invoice-number sequence (advisory lock + max+1) and the client link. Because
 * an AccountsInvoice stores line amounts ex-VAT and applies VAT via `vatRateBps`,
 * we push each quote line's extended (ex-VAT) amount and prorate the quote's
 * header discount across the lines, then pass the quote's `taxRateBps` as the
 * invoice VAT rate so the resulting totals match the quote's grand total.
 *
 * The created invoice id is persisted back onto the quote (`accountsInvoiceId`)
 * so a quote can only be converted once.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    let acknowledgeWarnings = false;
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        acknowledgeWarnings =
          (body as { acknowledgeWarnings?: boolean }).acknowledgeWarnings === true;
      }
    } catch {
      /* empty ok */
    }

    try {
      const result = await ctx.run(async (tx) => {
        const quote = await tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: {
            accountsClient: {
              include: { outsourcingClient: { select: { paymentTerms: true } } },
            },
            lineItems: { orderBy: { sortOrder: 'asc' } },
          },
        });
        if (!quote) throw Object.assign(new Error('QUOTE_NOT_FOUND'), { code: 'QUOTE_NOT_FOUND' });
        if (quote.accountsInvoiceId) {
          throw Object.assign(new Error('ALREADY_INVOICED'), { code: 'ALREADY_INVOICED' });
        }
        if (quote.status !== 'accepted') {
          throw Object.assign(new Error('QUOTE_NOT_ACCEPTED'), { code: 'QUOTE_NOT_ACCEPTED' });
        }
        if (!quote.accountsClientId) {
          throw Object.assign(new Error('CLIENT_REQUIRED'), { code: 'CLIENT_REQUIRED' });
        }
        if (quote.lineItems.length === 0) {
          throw Object.assign(new Error('NO_BILLABLE_LINES'), { code: 'NO_BILLABLE_LINES' });
        }

        const discountPct = Math.min(100, Math.max(0, Number(quote.discountPct)));
        const discountFactor = 1 - discountPct / 100;

        const lines: BillingLineDraft[] = quote.lineItems.map((li) => {
          const gross = lineItemExtendedAmount({
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
            discountPct: Number(li.discountPct),
            isRecurring: li.isRecurring,
            termMonths: li.termMonths,
          });
          return {
            item: li.description,
            description: li.isRecurring
              ? `Recurring (${li.termMonths ?? 1} mo)${discountPct > 0 ? ` · incl. ${discountPct}% quote discount` : ''}`
              : discountPct > 0
                ? `Incl. ${discountPct}% quote discount`
                : `Quote Q-${String(quote.quoteNumber).padStart(4, '0')} line`,
            amountExVat: round2(gross * discountFactor),
          };
        });

        const proposed = lines.reduce((s, l) => s + l.amountExVat, 0);
        const credit = await evaluateSalesCreditGate(tx, {
          organizationId: ctx.organizationId,
          accountsClientId: quote.accountsClientId,
          proposedAmount: proposed,
        });
        if (credit.warnings.length > 0 && !acknowledgeWarnings) {
          throw Object.assign(new Error('WARNINGS'), {
            code: 'WARNINGS',
            warnings: credit.warnings,
          });
        }

        const issueDate = quote.issueDate ?? new Date();
        const paymentTerms = quote.accountsClient?.outsourcingClient?.paymentTerms ?? null;
        const dueDate = quote.validUntil ?? dueDateFromIssue(issueDate, paymentTerms);

        const invoice = await createDraftAccountsInvoice(tx, {
          organizationId: ctx.organizationId,
          clientId: quote.accountsClientId,
          issueDate,
          dueDate,
          currency: quote.currency,
          notes: `Generated from quote Q-${String(quote.quoteNumber).padStart(4, '0')}: ${quote.title}`,
          lines,
          vatRateBps: quote.taxRateBps,
        });

        // Persist the link so the quote can't be invoiced twice.
        await tx.salesQuote.update({
          where: { id: quote.id },
          data: { accountsInvoiceId: invoice.id },
        });

        return {
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          accountsInvoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        };
      });

      return NextResponse.json({ result }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string; warnings?: string[] };
      if (err.code === 'WARNINGS') {
        return NextResponse.json(
          {
            error: 'Credit warnings require acknowledgement.',
            warnings: err.warnings ?? [],
            code: 'WARNINGS',
            requireAcknowledge: true,
          },
          { status: 409 },
        );
      }
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
