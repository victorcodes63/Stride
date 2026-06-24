import { prisma } from '@/lib/prisma';

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
): Promise<void> {
  const any =
    perms.canManageContracts ||
    perms.canManageInvoices ||
    perms.canManagePayments ||
    perms.canManageVendors;

  let existing: Awaited<ReturnType<typeof prisma.accountsStaffAccess.findFirst>> | null = null;
  try {
    existing = await prisma.accountsStaffAccess.findFirst({
      where: { userId, accountsClientId: null },
    });
  } catch (error) {
    const maybeCode = (error as { code?: string })?.code;
    if (maybeCode === 'P2021') return;
    throw error;
  }

  if (!any) {
    if (existing) {
      await prisma.accountsStaffAccess.delete({ where: { id: existing.id } });
    }
    return;
  }

  if (existing) {
    await prisma.accountsStaffAccess.update({
      where: { id: existing.id },
      data: {
        canManageContracts: perms.canManageContracts,
        canManageInvoices: perms.canManageInvoices,
        canManagePayments: perms.canManagePayments,
        canManageVendors: perms.canManageVendors,
      },
    });
  } else {
    await prisma.accountsStaffAccess.create({
      data: {
        userId,
        accountsClientId: null,
        canManageContracts: perms.canManageContracts,
        canManageInvoices: perms.canManageInvoices,
        canManagePayments: perms.canManagePayments,
        canManageVendors: perms.canManageVendors,
      },
    });
  }
}

export async function deleteGlobalAccountsAccessIfExists(userId: string): Promise<void> {
  let existing: Awaited<ReturnType<typeof prisma.accountsStaffAccess.findFirst>> | null = null;
  try {
    existing = await prisma.accountsStaffAccess.findFirst({
      where: { userId, accountsClientId: null },
    });
  } catch (error) {
    const maybeCode = (error as { code?: string })?.code;
    if (maybeCode === 'P2021') return;
    throw error;
  }
  if (existing) {
    await prisma.accountsStaffAccess.delete({ where: { id: existing.id } });
  }
}
