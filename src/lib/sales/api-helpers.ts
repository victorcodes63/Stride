import type { Prisma, SalesDeal } from '@prisma/client';
import type { StaffUser } from '@/lib/staff-api-auth';
import { lineItemExtendedAmount } from '@/lib/sales/access';

type DealLineItem = {
  id: string;
  description: string;
  quantity: unknown;
  unitPrice: unknown;
  discountPct: unknown;
  isRecurring: boolean;
  termMonths: number | null;
  sortOrder: number;
};

type DealWithRelations = SalesDeal & {
  owner?: { id: string; firstName: string; lastName: string } | null;
  accountsClient?: { id: string; name: string } | null;
  primaryContact?: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  lineItems?: DealLineItem[];
};

/** Resolve Employee id for a staff user via email match (same pattern as performance manager lookup). */
export async function resolveEmployeeIdForStaff(
  tx: Prisma.TransactionClient,
  staff: StaffUser,
  organizationId: string,
): Promise<string | null> {
  const employee = await tx.employee.findFirst({
    where: {
      organizationId,
      email: { equals: staff.email.trim(), mode: 'insensitive' },
    },
    select: { id: true },
  });
  return employee?.id ?? null;
}

export function currentMonthPeriod(now = new Date()): { periodStart: Date; periodEnd: Date } {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
  };
}

export function mapLineItemToJson(item: DealLineItem) {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  const discountPct = Number(item.discountPct);
  const extended = lineItemExtendedAmount({
    quantity,
    unitPrice,
    discountPct,
    isRecurring: item.isRecurring,
    termMonths: item.termMonths,
  });
  return {
    id: item.id,
    description: item.description,
    quantity,
    unitPrice,
    discountPct,
    isRecurring: item.isRecurring,
    termMonths: item.termMonths,
    sortOrder: item.sortOrder,
    extendedAmount: extended,
  };
}

export function mapDealToJson(d: DealWithRelations) {
  const lineItems = (d.lineItems ?? []).map(mapLineItemToJson);
  const lineTotal = lineItems.reduce((s, i) => s + i.extendedAmount, 0);
  return {
    id: d.id,
    name: d.name,
    stage: d.stage,
    value: Number(d.value),
    currency: d.currency,
    probability: d.probability,
    forecastCategory: d.forecastCategory,
    ownerEmployeeId: d.ownerEmployeeId,
    owner: d.owner
      ? { id: d.owner.id, name: `${d.owner.firstName} ${d.owner.lastName}`.trim() }
      : null,
    expectedCloseDate: d.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
    closedAt: d.closedAt?.toISOString() ?? null,
    accountsInvoiceId: d.accountsInvoiceId,
    accountsClientId: d.accountsClientId,
    accountsClient: d.accountsClient ?? null,
    primaryContactId: d.primaryContactId,
    primaryContact: d.primaryContact ?? null,
    source: d.source,
    nextStep: d.nextStep,
    nextStepDue: d.nextStepDue?.toISOString().slice(0, 10) ?? null,
    lostReason: d.lostReason,
    competitor: d.competitor,
    notes: d.notes,
    cargoWeightKg: d.cargoWeightKg ?? null,
    lineItems,
    lineItemsTotal: Math.round(lineTotal * 100) / 100,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export const dealInclude = {
  owner: { select: { id: true, firstName: true, lastName: true } },
  accountsClient: { select: { id: true, name: true } },
  primaryContact: {
    select: { id: true, name: true, title: true, email: true, phone: true },
  },
  lineItems: { orderBy: { sortOrder: 'asc' as const } },
} as const;
