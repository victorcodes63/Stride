import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateFleetCapacityForDeal,
  evaluateSalesLegalGate,
} from '@/lib/sales/cross-module-gates';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { requireAccessibleDeal, SalesAccessError } from '@/lib/sales/access';
import { createInvoiceFromWonDeal } from '@/lib/sales-finance-bridge';
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

        const [legal, fleet] = await Promise.all([
          evaluateSalesLegalGate(tx, {
            organizationId: ctx.organizationId,
            accountsClientId: deal.accountsClientId,
          }),
          evaluateFleetCapacityForDeal(tx, {
            organizationId: ctx.organizationId,
            cargoWeightKg: deal.cargoWeightKg,
          }),
        ]);
        const warnings = [...legal.warnings, ...fleet.warnings];
        if (warnings.length > 0 && !acknowledgeWarnings) {
          throw Object.assign(new Error('WARNINGS'), {
            code: 'WARNINGS',
            warnings,
          });
        }

        const created = await createInvoiceFromWonDeal(tx, {
          organizationId: ctx.organizationId,
          dealId,
          recordedByUserId: ctx.staff.id,
          createSalesActual: true,
        });

        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId,
            actorUserId: ctx.staff.id,
            actorEmail: ctx.staff.email,
            action: 'sales.deal.invoice_created',
            entityType: 'SalesDeal',
            entityId: dealId,
            route: `/api/sales/deals/${dealId}/create-invoice`,
            metadata: {
              accountsInvoiceId: created.accountsInvoiceId,
              invoiceNumber: created.invoiceNumber,
              salesActualId: created.salesActualId,
              alreadyLinked: created.alreadyLinked ?? false,
            },
          },
        });

        return { ...created, warnings };
      });

      return NextResponse.json(
        { result },
        { status: result.alreadyLinked ? 200 : 201 },
      );
    } catch (error: unknown) {
      if (error instanceof SalesAccessError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.code === 'FORBIDDEN' ? 403 : 404 },
        );
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
