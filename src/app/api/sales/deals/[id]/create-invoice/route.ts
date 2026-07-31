import { NextRequest, NextResponse } from 'next/server';
import {
  createDraftAccountsInvoice,
  dueDateFromIssue,
} from '@/lib/accounts/billing-automation';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { lineItemExtendedAmount, requireAccessibleDeal, SalesAccessError } from '@/lib/sales/access';
import { currentMonthPeriod } from '@/lib/sales/api-helpers';
import {
  evaluateFleetCapacityForDeal,
  evaluateSalesCreditGate,
  evaluateSalesLegalGate,
} from '@/lib/sales/cross-module-gates';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id: dealId } = await params;
    let acknowledgeWarnings = false;
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        acknowledgeWarnings =
          (body as { acknowledgeWarnings?: boolean }).acknowledgeWarnings === true;
      }
    } catch {
      /* empty body ok */
    }

    try {
      const result = await ctx.run(async (tx) => {
        await requireAccessibleDeal(tx, ctx.staff, ctx.organizationId, dealId);
        const deal = await tx.salesDeal.findFirst({
          where: { id: dealId, ...ctx.where() },
          include: {
            accountsClient: {
              include: {
                outsourcingClient: { select: { paymentTerms: true } },
              },
            },
            lineItems: { orderBy: { sortOrder: 'asc' } },
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

        const [legal, fleet, credit] = await Promise.all([
          evaluateSalesLegalGate(tx, {
            organizationId: ctx.organizationId,
            accountsClientId: deal.accountsClientId,
          }),
          evaluateFleetCapacityForDeal(tx, {
            organizationId: ctx.organizationId,
            cargoWeightKg: deal.cargoWeightKg,
          }),
          evaluateSalesCreditGate(tx, {
            organizationId: ctx.organizationId,
            accountsClientId: deal.accountsClientId,
            proposedAmount: Number(deal.value),
          }),
        ]);
        const warnings = [...legal.warnings, ...fleet.warnings, ...credit.warnings];
        if (warnings.length > 0 && !acknowledgeWarnings) {
          throw Object.assign(new Error('WARNINGS'), {
            code: 'WARNINGS',
            warnings,
          });
        }

        const issueDate = deal.closedAt ?? new Date();
        const paymentTerms = deal.accountsClient?.outsourcingClient?.paymentTerms ?? null;
        const dueDate = dueDateFromIssue(issueDate, paymentTerms);
        const dealValue = Number(deal.value);

        const lines =
          deal.lineItems.length > 0
            ? deal.lineItems.map((li) => ({
                item: li.description,
                description: li.isRecurring
                  ? `Recurring (${li.termMonths ?? 1} mo)`
                  : 'Sales deal line',
                amountExVat: lineItemExtendedAmount({
                  quantity: Number(li.quantity),
                  unitPrice: Number(li.unitPrice),
                  discountPct: Number(li.discountPct),
                  isRecurring: li.isRecurring,
                  termMonths: li.termMonths,
                }),
              }))
            : [
                {
                  item: deal.name,
                  description: 'Sales deal — closed won',
                  amountExVat: dealValue,
                },
              ];

        const invoice = await createDraftAccountsInvoice(tx, {
          organizationId: ctx.organizationId,
          clientId: deal.accountsClientId,
          issueDate,
          dueDate,
          currency: deal.currency,
          notes: `Closed-won deal: ${deal.name}`,
          lines,
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
          warnings,
        };
      });

      return NextResponse.json({ result }, { status: 201 });
    } catch (error: unknown) {
      if (error instanceof SalesAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 404 });
      }
      const err = error as { code?: string; warnings?: string[] };
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
      if (err.code === 'WARNINGS') {
        return NextResponse.json(
          {
            error: 'Close warnings require acknowledgement.',
            warnings: err.warnings ?? [],
            requireAcknowledge: true,
          },
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
