import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/types/dashboard';

export type AccountsPermissions = {
  canManageContracts: boolean;
  canManageInvoices: boolean;
  canManagePayments: boolean;
  canManageVendors: boolean;
};

/** Merged flags from all AccountsStaffAccess rows for this user. Admins get full access. */
export async function getAccountsAccess(
  userId: string,
  role: UserRole,
): Promise<{ hasAccountsAccess: boolean } & AccountsPermissions> {
  if (role === 'admin') {
    return {
      hasAccountsAccess: true,
      canManageContracts: true,
      canManageInvoices: true,
      canManagePayments: true,
      canManageVendors: true,
    };
  }

  let rows: Awaited<ReturnType<typeof prisma.accountsStaffAccess.findMany>> = [];
  try {
    rows = await prisma.accountsStaffAccess.findMany({
      where: { userId },
    });
  } catch (error) {
    const maybeCode = (error as { code?: string })?.code;
    // Backward compatibility: if Accounts module tables are not migrated yet,
    // treat staff users as having no Accounts access instead of failing APIs.
    if (maybeCode === 'P2021') {
      return {
        hasAccountsAccess: false,
        canManageContracts: false,
        canManageInvoices: false,
        canManagePayments: false,
        canManageVendors: false,
      };
    }
    throw error;
  }

  if (rows.length === 0) {
    return {
      hasAccountsAccess: false,
      canManageContracts: false,
      canManageInvoices: false,
      canManagePayments: false,
      canManageVendors: false,
    };
  }

  const p = rows.reduce(
    (acc, r) => ({
      canManageContracts: acc.canManageContracts || r.canManageContracts,
      canManageInvoices: acc.canManageInvoices || r.canManageInvoices,
      canManagePayments: acc.canManagePayments || r.canManagePayments,
      canManageVendors: acc.canManageVendors || r.canManageVendors,
    }),
    {
      canManageContracts: false,
      canManageInvoices: false,
      canManagePayments: false,
      canManageVendors: false,
    },
  );

  return { hasAccountsAccess: true, ...p };
}
