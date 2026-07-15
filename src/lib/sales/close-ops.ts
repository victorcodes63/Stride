import type { Prisma, PrismaClient } from '@prisma/client';
import { nextFleetOrderNumber } from '@/lib/fleet-numbers';
import { allocateProjectCode } from '@/lib/projects/project-code';

export type CloseOpsOptions = {
  /** Default true — creates a planning project draft. */
  createProject?: boolean;
  createFleetOrder?: boolean;
  createPurchaseRequest?: boolean;
  pickupLocation?: string | null;
  deliveryLocation?: string | null;
};

export type CloseOpsResult = {
  projectId: string | null;
  projectCode: string | null;
  fleetOrderId: string | null;
  fleetOrderNumber: string | null;
  purchaseRequestId: string | null;
  notes: string[];
};

type Db = PrismaClient | Prisma.TransactionClient;

/** Best-effort drafts when a deal is marked won (does not fail the win if deps missing). */
export async function createCloseOpsDrafts(
  tx: Db,
  params: {
    organizationId: string;
    deal: {
      id: string;
      name: string;
      value: unknown;
      currency: string;
      cargoWeightKg: number | null;
      accountsClientId: string | null;
    };
    staffUserId: string;
    options: CloseOpsOptions;
  },
): Promise<CloseOpsResult> {
  const result: CloseOpsResult = {
    projectId: null,
    projectCode: null,
    fleetOrderId: null,
    fleetOrderNumber: null,
    purchaseRequestId: null,
    notes: [],
  };

  const workspaceClient = await tx.outsourcingClient.findFirst({
    where: { organizationId: params.organizationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const wantProject = params.options.createProject !== false;
  if (wantProject) {
    try {
      if (!workspaceClient) {
        result.notes.push('Skipped project draft — no workspace client.');
      } else {
        const projectCode = await allocateProjectCode(tx, workspaceClient.id);
        const project = await tx.project.create({
          data: {
            organizationId: params.organizationId,
            outsourcingClientId: workspaceClient.id,
            projectCode,
            name: `Delivery: ${params.deal.name}`,
            description: `Auto-created from closed-won sales deal ${params.deal.id}`,
            status: 'planning',
            currency: params.deal.currency,
            budgetAmount: Number(params.deal.value),
            ownerUserId: params.staffUserId,
            createdByUserId: params.staffUserId,
          },
        });
        result.projectId = project.id;
        result.projectCode = project.projectCode;
        result.notes.push(`Project draft ${project.projectCode} created.`);
      }
    } catch (e) {
      result.notes.push(
        `Project draft failed: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
  }

  if (params.options.createFleetOrder) {
    try {
      if (!workspaceClient) {
        result.notes.push('Skipped fleet order — no workspace client.');
      } else {
        const customer =
          (params.deal.accountsClientId
            ? await tx.fleetCustomer.findFirst({
                where: {
                  organizationId: params.organizationId,
                  outsourcingClientId: workspaceClient.id,
                  accountsClientId: params.deal.accountsClientId,
                },
              })
            : null) ??
          (await tx.fleetCustomer.findFirst({
            where: {
              organizationId: params.organizationId,
              outsourcingClientId: workspaceClient.id,
            },
            orderBy: { createdAt: 'asc' },
          }));

        if (!customer) {
          result.notes.push('Skipped fleet order — no Fleet customer on file.');
        } else {
          const pickup = params.options.pickupLocation?.trim() || 'Nairobi depot';
          const delivery =
            params.options.deliveryLocation?.trim() || 'Customer site — confirm with sales';
          const orderNumber = await nextFleetOrderNumber(tx as PrismaClient, workspaceClient.id);
          const order = await tx.fleetOrder.create({
            data: {
              organizationId: params.organizationId,
              outsourcingClientId: workspaceClient.id,
              customerId: customer.id,
              orderNumber,
              pickupLocation: pickup,
              deliveryLocation: delivery,
              cargoType: 'Sales closed-won cargo',
              cargoWeightKg: params.deal.cargoWeightKg,
              notes: `From sales deal: ${params.deal.name} (${params.deal.id})`,
              status: 'draft',
            },
          });
          result.fleetOrderId = order.id;
          result.fleetOrderNumber = order.orderNumber;
          result.notes.push(`Fleet order draft ${order.orderNumber} created.`);
        }
      }
    } catch (e) {
      result.notes.push(
        `Fleet order draft failed: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
  }

  if (params.options.createPurchaseRequest) {
    try {
      if (!workspaceClient) {
        result.notes.push('Skipped purchase request — no workspace client.');
      } else {
        const amount = Math.round(Number(params.deal.value) * 0.1 * 100) / 100 || 1;
        const year = new Date().getUTCFullYear();
        const count = await tx.purchaseRequest.count({
          where: { organizationId: params.organizationId },
        });
        const requestNumber = `PR-${year}-${String(count + 1).padStart(4, '0')}`;
        const pr = await tx.purchaseRequest.create({
          data: {
            organizationId: params.organizationId,
            outsourcingClientId: workspaceClient.id,
            requestNumber,
            title: `Fulfilment supplies — ${params.deal.name}`,
            justification: `Auto-drafted from closed-won sales deal ${params.deal.id}`,
            currency: params.deal.currency,
            totalAmount: amount,
            status: 'draft',
            requestedByUserId: params.staffUserId,
            lines: {
              create: [
                {
                  organizationId: params.organizationId,
                  item: 'Deal fulfilment contingency',
                  description: 'Placeholder line — adjust before submit',
                  quantity: 1,
                  unitPrice: amount,
                  sortOrder: 0,
                },
              ],
            },
          },
        });
        result.purchaseRequestId = pr.id;
        result.notes.push(`Purchase request draft ${requestNumber} created.`);
      }
    } catch (e) {
      result.notes.push(
        `Purchase request draft failed: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
  }

  return result;
}
