import type { Prisma, SalesDeal } from '@prisma/client';
import type { StaffUser } from '@/lib/staff-api-auth';
import { can } from '@/lib/rbac/can';
import {
  canManageSalesAdmin,
  canManageSalesTargets,
  canViewAllSalesDeals,
} from '@/lib/staff-permissions';
import { resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';

/** Settings routes: permission catalog `sales.admin` or manager/director staff type. */
export async function hasSalesAdminAccess(staff: StaffUser): Promise<boolean> {
  if (await can(staff, 'sales.admin')) return true;
  return canManageSalesAdmin(staff.role, staff.staffUserType);
}

/**
 * CRM manage / margin visibility (pairs with `sales.manage`).
 * Accept (B1): plain sales_rep never sees cost/margin even if catalog grants staff.
 */
export async function hasSalesManageAccess(staff: StaffUser): Promise<boolean> {
  if (staff.role === 'admin') return true;
  if (staff.staffUserType === 'sales_rep') return false;
  if (await can(staff, 'sales.manage')) return true;
  return canManageSalesAdmin(staff.role, staff.staffUserType);
}

/** Cost & margin columns — alias of manage access for B1 UI/API gating. */
export async function canViewSalesMargin(staff: StaffUser): Promise<boolean> {
  return hasSalesManageAccess(staff);
}

/** Approver-style commission / target management (pairs with `sales.manage_commissions`). */
export async function hasSalesCommissionManageAccess(staff: StaffUser): Promise<boolean> {
  if (await can(staff, 'sales.manage_commissions')) return true;
  return canManageSalesTargets(staff.role, staff.staffUserType);
}

/** Quote approval (pairs with `sales.approve_quotes`); admin / sales managers until B ships. */
export async function hasSalesQuoteApproveAccess(staff: StaffUser): Promise<boolean> {
  if (await can(staff, 'sales.approve_quotes')) return true;
  return canManageSalesAdmin(staff.role, staff.staffUserType);
}

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
