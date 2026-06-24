import { getAccountsAccess } from '@/lib/accounts-access';
import { canApproveStaffLeave, canViewSystemAnalytics } from '@/lib/staff-permissions';
import type { StaffUserType, UserRole, UserSummary } from '@/types/dashboard';

export async function userRowToSummary(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  staffUserType: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Promise<UserSummary> {
  const role = user.role as UserRole;
  const staffUserType = user.staffUserType as StaffUserType;
  const acc = await getAccountsAccess(user.id, role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    staffUserType,
    canApproveStaffLeave: canApproveStaffLeave(role, staffUserType),
    canViewSystemAnalytics: canViewSystemAnalytics(role, staffUserType),
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    hasAccountsAccess: acc.hasAccountsAccess,
    accountsPermissions: {
      canManageContracts: acc.canManageContracts,
      canManageInvoices: acc.canManageInvoices,
      canManagePayments: acc.canManagePayments,
      canManageVendors: acc.canManageVendors,
    },
  };
}
