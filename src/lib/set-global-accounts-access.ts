import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';

export type GlobalAccountsPermInput = {
  canManageContracts: boolean;
  canManageInvoices: boolean;
  canManagePayments: boolean;
  canManageVendors: boolean;
};

/** Single global AccountsStaffAccess row (accountsClientId null). Removes row if all flags false. */
export async function setUserGlobalAccountsAccess(
  userId: string,
  perms: GlobalAccountsPermInput,
  organizationId: string,
): Promise<void> {
  const any =
    perms.canManageContracts ||
    perms.canManageInvoices ||
    perms.canManagePayments ||
    perms.canManageVendors;

  await withOrgContext(organizationId, async (tx) => {
    let existing: Awaited<ReturnType<typeof tx.accountsStaffAccess.findFirst>> | null = null;
    try {
      existing = await tx.accountsStaffAccess.findFirst({
        where: { userId, accountsClientId: null },
      });
    } catch (error) {
      const maybeCode = (error as { code?: string })?.code;
      if (maybeCode === 'P2021') return;
      throw error;
    }

    if (!any) {
      if (existing) {
        await tx.accountsStaffAccess.delete({ where: { id: existing.id } });
      }
      return;
    }

    if (existing) {
      await tx.accountsStaffAccess.update({
        where: { id: existing.id },
        data: {
          canManageContracts: perms.canManageContracts,
          canManageInvoices: perms.canManageInvoices,
          canManagePayments: perms.canManagePayments,
          canManageVendors: perms.canManageVendors,
        },
      });
    } else {
      await tx.accountsStaffAccess.create({
        data: {
          organizationId,
          userId,
          accountsClientId: null,
          canManageContracts: perms.canManageContracts,
          canManageInvoices: perms.canManageInvoices,
          canManagePayments: perms.canManagePayments,
          canManageVendors: perms.canManageVendors,
        },
      });
    }
  });
}

export async function deleteGlobalAccountsAccessIfExists(
  userId: string,
  organizationId: string,
): Promise<void> {
  await withOrgContext(organizationId, async (tx) => {
    let existing: Awaited<ReturnType<typeof tx.accountsStaffAccess.findFirst>> | null = null;
    try {
      existing = await tx.accountsStaffAccess.findFirst({
        where: { userId, accountsClientId: null },
      });
    } catch (error) {
      const maybeCode = (error as { code?: string })?.code;
      if (maybeCode === 'P2021') return;
      throw error;
    }
    if (existing) {
      await tx.accountsStaffAccess.delete({ where: { id: existing.id } });
    }
  });
}
