import type { Prisma, SaccoAccountType, SaccoLedgerEntryType } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const CREDIT_TYPES: SaccoLedgerEntryType[] = ['contribution', 'dividend', 'interest', 'adjustment'];
const DEBIT_TYPES: SaccoLedgerEntryType[] = ['withdrawal', 'transfer'];

export function isCreditEntry(entryType: SaccoLedgerEntryType): boolean {
  return CREDIT_TYPES.includes(entryType);
}

export function signedAmount(entryType: SaccoLedgerEntryType, amount: number): number {
  const abs = Math.abs(amount);
  if (DEBIT_TYPES.includes(entryType)) return -abs;
  if (CREDIT_TYPES.includes(entryType)) return abs;
  return amount;
}

export async function ensureMemberAccounts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  memberId: string,
) {
  const types: SaccoAccountType[] = ['shares', 'bosa', 'fosa'];
  for (const accountType of types) {
    await tx.saccoAccount.upsert({
      where: { memberId_accountType: { memberId, accountType } },
      create: { organizationId, memberId, accountType },
      update: {},
    });
  }
}

export async function postLedgerEntry(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    accountId: string;
    entryType: SaccoLedgerEntryType;
    amount: number;
    entryDate: Date;
    reference?: string | null;
    description?: string | null;
    createdByUserId?: string | null;
  },
) {
  const account = await tx.saccoAccount.findUniqueOrThrow({ where: { id: input.accountId } });
  const delta = signedAmount(input.entryType, input.amount);
  const current = Number(account.balance);
  const balanceAfter = current + delta;
  if (balanceAfter < -0.005) {
    throw new Error('Insufficient account balance for this transaction.');
  }

  const entry = await tx.saccoLedgerEntry.create({
    data: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      entryType: input.entryType,
      amount: Math.abs(input.amount),
      balanceAfter,
      reference: input.reference ?? null,
      description: input.description ?? null,
      entryDate: input.entryDate,
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  await tx.saccoAccount.update({
    where: { id: input.accountId },
    data: { balance: balanceAfter },
  });

  return entry;
}

export async function createMemberWithAccounts(
  db: PrismaClient,
  data: {
    organizationId: string;
    outsourcingClientId: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    joinedAt: Date;
    nationalId?: string | null;
    phone?: string | null;
    email?: string | null;
    employeeId?: string | null;
    notes?: string | null;
  },
) {
  return db.$transaction(async (tx) => {
    const member = await tx.saccoMember.create({ data });
    await ensureMemberAccounts(tx, data.organizationId, member.id);
    return member;
  });
}
