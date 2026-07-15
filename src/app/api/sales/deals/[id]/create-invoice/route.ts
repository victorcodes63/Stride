import { NextRequest, NextResponse } from 'next/server';
import {
  createDraftAccountsInvoice,
  dueDateFromIssue,
} from '@/lib/accounts/billing-automation';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { currentMonthPeriod } from '@/lib/sales/api-helpers';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id: dealId } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const deal = await tx.salesDeal.findFirst({
          where: { id: dealId, ...ctx.where() },
          include: {
            accountsClient: {
              include: {
                outsourcingClient: { select: { paymentTerms: true } },
              },
            },
          },
        });

        if (!deal) {
          throw Object.assign(new Error('DEAL_NOT_FOUND'), { code: 'DEAL_NOT_FOUND' });
        }
        if (deal.stage !== 'won') {
          throw Object.assign(new Error('DEAL_NOT_WON'), { code: 'DEAL_NOT_WON' });
        }
        if (!deal.accountsClientId) {
          throw Object.assign(new Error('CLIENT_REQUIRED'), { code: 'CLIENT_REQUIRED' });
        }
        if (deal.accountsInvoiceId) {
          throw Object.assign(new Error('INVOICE_EXISTS'), { code: 'INVOICE_EXISTS' });
        }

        const issueDate = deal.closedAt ?? new Date();
        const paymentTerms = deal.accountsClient?.outsourcingClient?.paymentTerms ?? null;
        const dueDate = dueDateFromIssue(issueDate, paymentTerms);
        const dealValue = Number(deal.value);

        const invoice = await createDraftAccountsInvoice(tx, {
          organizationId: ctx.organizationId,
          clientId: deal.accountsClientId,
          issueDate,
          dueDate,
          currency: deal.currency,
          notes: `Closed-won deal: ${deal.name}`,
          lines: [
            {
              item: deal.name,
              description: 'Sales deal — closed won',
              amountExVat: dealValue,
            },
          ],
        });

        const updatedDeal = await tx.salesDeal.update({
          where: { id: dealId },
          data: { accountsInvoiceId: invoice.id },
        });

        const { periodStart, periodEnd } = currentMonthPeriod(deal.closedAt ?? new Date());

        const existingActual = await tx.salesActual.findFirst({
          where: {
            organizationId: ctx.organizationId,
            salesDealId: dealId,
          },
        });

        let actualId: string | null = existingActual?.id ?? null;
        if (!existingActual) {
          const actual = await tx.salesActual.create({
            data: {
              organizationId: ctx.organizationId,
              employeeId: deal.ownerEmployeeId,
              periodStart,
              periodEnd,
              amount: dealValue,
              currency: deal.currency,
              source: 'finance_invoice',
              salesDealId: dealId,
              accountsInvoiceId: invoice.id,
              notes: `Auto-created from closed-won deal: ${deal.name}`,
              recordedByUserId: ctx.staff.id,
            },
          });
          actualId = actual.id;
        }

        await syncRepPeriodMetric(tx, {
          organizationId: ctx.organizationId,
          employeeId: deal.ownerEmployeeId,
          periodStart,
          periodEnd,
          currency: deal.currency,
        });

        return {
          dealId: updatedDeal.id,
          accountsInvoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          salesActualId: actualId,
        };
      });

      return NextResponse.json({ result }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'DEAL_NOT_FOUND') {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }
      if (err.code === 'DEAL_NOT_WON') {
        return NextResponse.json(
          { error: 'Invoice can only be created for won deals.' },
          { status: 400 },
        );
      }
      if (err.code === 'CLIENT_REQUIRED') {
        return NextResponse.json(
          { error: 'Deal must have an accounts client before invoicing.' },
          { status: 400 },
        );
      }
      if (err.code === 'INVOICE_EXISTS') {
        return NextResponse.json(
          { error: 'Deal already has a linked invoice.' },
          { status: 409 },
        );
      }
      if (err.code === 'NO_BILLABLE_LINES') {
        return NextResponse.json({ error: 'Deal value must be billable.' }, { status: 400 });
      }
      await reportApiError({
        route: 'POST /api/sales/deals/[id]/create-invoice',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create invoice.' }, { status: 500 });
    }
  });
}
