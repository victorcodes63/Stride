import { getAccountsAccess } from '@/lib/accounts-access';
import { canApproveStaffLeave, canViewSystemAnalytics } from '@/lib/staff-permissions';
import type { OrganizationSummary, StaffUserType, UserRole, UserSummary } from '@/types/dashboard';

type OrgContext = {
  currentOrgId: string | null;
  currentOrgName: string | null;
  organizations: OrganizationSummary[];
};

export async function userRowToSummary(
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    staffUserType: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  orgContext?: OrgContext,
): Promise<UserSummary> {
  const role = (orgContext?.organizations.find((o) => o.id === orgContext.currentOrgId)?.role ??
    user.role) as UserRole;
  const staffUserType = user.staffUserType as StaffUserType;
  const orgId = orgContext?.currentOrgId ?? null;
  const acc = await getAccountsAccess(user.id, role, orgId);
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
    currentOrgId: orgContext?.currentOrgId ?? null,
    currentOrgName: orgContext?.currentOrgName ?? null,
    organizations: orgContext?.organizations ?? [],
  };
}
