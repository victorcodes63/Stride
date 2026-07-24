/**
 * B4 — Won-deal automation (invoice / actual / delivery project / fleet offer).
 * Idempotent: re-entering won or re-saving must not duplicate invoice, actual, or project.
 */
import type { Prisma } from '@prisma/client';
import { allocateProjectCode } from '@/lib/projects/project-code';
import {
  convertAcceptedQuoteToInvoice,
  createInvoiceFromWonDeal,
  ensureSalesActualForDeal,
} from '@/lib/sales-finance-bridge';
import { resolveAccountsClient } from '@/lib/sales/resolve-accounts-client';
import {
  loadWonDealSettings,
  type WonDealAutomationSettings,
} from '@/lib/sales/won-deal-settings';

type Tx = Prisma.TransactionClient;

export type FleetOrderOffer = {
  dealId: string;
  dealName: string;
  cargoWeightKg: number | null;
  accountsClientId: string | null;
  fleetCustomerId: string | null;
  fleetCustomerName: string | null;
  suggestedPickup: string;
  suggestedDelivery: string;
  notes: string;
};

export type WonDealAutomationResult = {
  settings: WonDealAutomationSettings;
  notes: string[];
  invoiceId: string | null;
  invoiceNumber: number | null;
  salesActualId: string | null;
  projectId: string | null;
  projectCode: string | null;
  fleetOffer: FleetOrderOffer | null;
};

export async function runWonDealAutomation(
  tx: Tx,
  params: {
    organizationId: string;
    dealId: string;
    staffUserId: string;
    /** Effective modules for this request — fleet offer only when fleet is true. */
    fleetLicensed: boolean;
    /** After user accepts the fleet prompt, create the order (still settings-gated). */
    confirmFleetOrder?: boolean;
    pickupLocation?: string | null;
    deliveryLocation?: string | null;
  },
): Promise<WonDealAutomationResult> {
  const settings = await loadWonDealSettings(tx, params.organizationId);
  const result: WonDealAutomationResult = {
    settings,
    notes: [],
    invoiceId: null,
    invoiceNumber: null,
    salesActualId: null,
    projectId: null,
    projectCode: null,
    fleetOffer: null,
  };

  const deal = await tx.salesDeal.findFirst({
    where: { id: params.dealId, organizationId: params.organizationId },
  });
  if (!deal || deal.stage !== 'won') {
    result.notes.push('Skipped automation — deal is not won.');
    return result;
  }

  // B3: revised quotes keep status=accepted on the prior row with supersededById set.
  // Only a current (non-superseded) accepted quote satisfies requireAcceptedQuote / auto-invoice.
  const acceptedQuote = await tx.salesQuote.findFirst({
    where: {
      organizationId: params.organizationId,
      dealId: deal.id,
      status: 'accepted',
      supersededById: null,
    },
    orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
  });

  if (settings.requireAcceptedQuote && !acceptedQuote) {
    throw Object.assign(new Error('ACCEPTED_QUOTE_REQUIRED'), {
      code: 'ACCEPTED_QUOTE_REQUIRED',
    });
  }

  // —— Invoice ——
  if (settings.autoCreateInvoice) {
    try {
      if (acceptedQuote) {
        const inv = await convertAcceptedQuoteToInvoice(tx, {
          organizationId: params.organizationId,
          quoteId: acceptedQuote.id,
        });
        result.invoiceId = inv.accountsInvoiceId;
        result.invoiceNumber = inv.invoiceNumber;
        result.notes.push(
          inv.alreadyLinked
            ? `Invoice #${inv.invoiceNumber} already linked to quote.`
            : `Invoice #${inv.invoiceNumber} created from accepted quote.`,
        );
      } else if (deal.accountsClientId) {
        const inv = await createInvoiceFromWonDeal(tx, {
          organizationId: params.organizationId,
          dealId: deal.id,
          recordedByUserId: params.staffUserId,
          createSalesActual: settings.autoCreateSalesActual,
        });
        result.invoiceId = inv.accountsInvoiceId;
        result.invoiceNumber = inv.invoiceNumber;
        result.salesActualId = inv.salesActualId;
        result.notes.push(
          inv.alreadyLinked
            ? `Invoice #${inv.invoiceNumber} already linked to deal.`
            : `Invoice #${inv.invoiceNumber} created from deal.`,
        );
      } else {
        result.notes.push('Skipped auto-invoice — no billing client on deal.');
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'CLIENT_REQUIRED' || code === 'NO_BILLABLE_LINES') {
        result.notes.push(
          `Skipped auto-invoice — ${e instanceof Error ? e.message : 'not billable'}.`,
        );
      } else {
        throw e;
      }
    }
  }

  // —— SalesActual (if not already created with invoice) ——
  if (settings.autoCreateSalesActual && !result.salesActualId) {
    const refreshed = await tx.salesDeal.findFirst({
      where: { id: deal.id },
      select: {
        id: true,
        ownerEmployeeId: true,
        value: true,
        currency: true,
        closedAt: true,
        accountsInvoiceId: true,
        name: true,
      },
    });
    if (refreshed) {
      const source = refreshed.accountsInvoiceId ? 'finance_invoice' : 'deal';
      result.salesActualId = await ensureSalesActualForDeal(tx, {
        organizationId: params.organizationId,
        dealId: refreshed.id,
        ownerEmployeeId: refreshed.ownerEmployeeId,
        amount: Number(refreshed.value),
        currency: refreshed.currency,
        closedAt: refreshed.closedAt,
        accountsInvoiceId: refreshed.accountsInvoiceId,
        recordedByUserId: params.staffUserId,
        notes: `Auto-created on won deal: ${refreshed.name}`,
        source,
      });
      result.notes.push(`Sales actual recorded (${source}).`);
      if (refreshed.accountsInvoiceId) {
        result.invoiceId = result.invoiceId ?? refreshed.accountsInvoiceId;
      }
    }
  }

  // —— Delivery project ——
  if (settings.createDeliveryProject) {
    const existingProject = await tx.project.findFirst({
      where: {
        organizationId: params.organizationId,
        sourceDealId: deal.id,
      },
      select: { id: true, projectCode: true },
    });
    if (existingProject) {
      result.projectId = existingProject.id;
      result.projectCode = existingProject.projectCode;
      result.notes.push(`Delivery project ${existingProject.projectCode} already linked.`);
    } else {
      const client = await resolveAccountsClient(
        tx,
        params.organizationId,
        deal.accountsClientId,
      );
      if (!client?.outsourcingClientId) {
        result.notes.push(
          'Skipped delivery project — billing client has no outsourcing profile (AccountsClient.outsourcingClientId is null).',
        );
      } else {
        try {
          const projectCode = await allocateProjectCode(tx, client.outsourcingClientId);
          const project = await tx.project.create({
            data: {
              organizationId: params.organizationId,
              outsourcingClientId: client.outsourcingClientId,
              projectCode,
              name: `Delivery: ${deal.name}`,
              description: `Auto-created from closed-won sales deal ${deal.id}`,
              status: 'planning',
              currency: deal.currency,
              budgetAmount: Number(deal.value),
              ownerUserId: params.staffUserId,
              createdByUserId: params.staffUserId,
              sourceDealId: deal.id,
            },
          });
          result.projectId = project.id;
          result.projectCode = project.projectCode;
          result.notes.push(`Delivery project ${project.projectCode} created.`);
        } catch (e) {
          result.notes.push(
            `Delivery project failed: ${e instanceof Error ? e.message : 'unknown error'}`,
          );
        }
      }
    }
  }

  // —— Fleet offer (prompt only unless confirmFleetOrder) ——
  if (settings.offerFleetOrder && params.fleetLicensed) {
    const fleetCustomer = deal.accountsClientId
      ? await tx.fleetCustomer.findFirst({
          where: {
            organizationId: params.organizationId,
            accountsClientId: deal.accountsClientId,
          },
          select: { id: true, name: true, outsourcingClientId: true },
        })
      : null;

    result.fleetOffer = {
      dealId: deal.id,
      dealName: deal.name,
      cargoWeightKg: deal.cargoWeightKg,
      accountsClientId: deal.accountsClientId,
      fleetCustomerId: fleetCustomer?.id ?? null,
      fleetCustomerName: fleetCustomer?.name ?? null,
      suggestedPickup: params.pickupLocation?.trim() || 'Nairobi depot',
      suggestedDelivery:
        params.deliveryLocation?.trim() || 'Customer site — confirm with sales',
      notes: `From sales deal: ${deal.name} (${deal.id})`,
    };
    result.notes.push(
      params.confirmFleetOrder
        ? 'Fleet order creation requested by user.'
        : 'Fleet order offered — confirm in UI to create (not auto-created).',
    );
  } else if (settings.offerFleetOrder && !params.fleetLicensed) {
    result.notes.push('Fleet order offer skipped — fleet module not licensed.');
  }

  return result;
}
