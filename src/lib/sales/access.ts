import type { Prisma, SalesDeal } from '@prisma/client';
import type { StaffUser } from '@/lib/staff-api-auth';
import { canViewAllSalesDeals } from '@/lib/staff-permissions';
import { resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';

export class SalesAccessError extends Error {
  code: 'FORBIDDEN' | 'NOT_FOUND';
  constructor(code: 'FORBIDDEN' | 'NOT_FOUND', message: string) {
    super(message);
    this.code = code;
  }
}

/** Soft-scope deals for reps; managers/admins see all unless owner filter set. */
export async function applySalesDealOwnerScope(
  tx: Prisma.TransactionClient,
  staff: StaffUser,
  organizationId: string,
  where: Prisma.SalesDealWhereInput,
  explicitOwner?: string,
): Promise<Prisma.SalesDealWhereInput> {
  if (explicitOwner) {
    return { ...where, ownerEmployeeId: explicitOwner };
  }
  if (canViewAllSalesDeals(staff.role, staff.staffUserType)) {
    return where;
  }
  const linkedEmployeeId = await resolveEmployeeIdForStaff(tx, staff, organizationId);
  if (linkedEmployeeId) {
    return { ...where, ownerEmployeeId: linkedEmployeeId };
  }
  return { ...where, ownerEmployeeId: '__unlinked__' };
}

/** Load deal and enforce owner scoping for reps (managers/admins pass). */
export async function requireAccessibleDeal(
  tx: Prisma.TransactionClient,
  staff: StaffUser,
  organizationId: string,
  dealId: string,
): Promise<SalesDeal> {
  const deal = await tx.salesDeal.findFirst({
    where: { id: dealId, organizationId },
  });
  if (!deal) {
    throw new SalesAccessError('NOT_FOUND', 'Deal not found.');
  }
  if (canViewAllSalesDeals(staff.role, staff.staffUserType)) {
    return deal;
  }
  const linkedEmployeeId = await resolveEmployeeIdForStaff(tx, staff, organizationId);
  if (!linkedEmployeeId || deal.ownerEmployeeId !== linkedEmployeeId) {
    throw new SalesAccessError('FORBIDDEN', 'You can only access your own deals.');
  }
  return deal;
}

/** Reps may only assign deals to themselves. */
export async function resolveOwnerForCreate(
  tx: Prisma.TransactionClient,
  staff: StaffUser,
  organizationId: string,
  requestedOwnerEmployeeId: string,
): Promise<string> {
  if (canViewAllSalesDeals(staff.role, staff.staffUserType)) {
    return requestedOwnerEmployeeId;
  }
  const linkedEmployeeId = await resolveEmployeeIdForStaff(tx, staff, organizationId);
  if (!linkedEmployeeId) {
    throw new SalesAccessError(
      'FORBIDDEN',
      'Your user is not linked to an employee record — cannot create deals.',
    );
  }
  if (requestedOwnerEmployeeId !== linkedEmployeeId) {
    throw new SalesAccessError('FORBIDDEN', 'Sales reps can only create deals for themselves.');
  }
  return linkedEmployeeId;
}

export function lineItemExtendedAmount(item: {
  quantity: number;
  unitPrice: number;
  discountPct: number;
  isRecurring: boolean;
  termMonths: number | null;
}): number {
  const base =
    item.quantity * item.unitPrice * (1 - Math.min(100, Math.max(0, item.discountPct)) / 100);
  const months = item.isRecurring && item.termMonths && item.termMonths > 0 ? item.termMonths : 1;
  return Math.round(base * months * 100) / 100;
}
