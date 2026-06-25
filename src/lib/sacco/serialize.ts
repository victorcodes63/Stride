import type {
  SaccoAccount,
  SaccoDividendLine,
  SaccoDividendRun,
  SaccoLedgerEntry,
  SaccoMember,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export type SaccoMemberRow = SaccoMember & {
  accounts?: SaccoAccount[];
  employee?: { id: string; firstName: string; lastName: string } | null;
};

export function serializeMember(member: SaccoMemberRow) {
  const shares = member.accounts?.find((a) => a.accountType === 'shares');
  const bosa = member.accounts?.find((a) => a.accountType === 'bosa');
  const fosa = member.accounts?.find((a) => a.accountType === 'fosa');

  return {
    id: member.id,
    memberNumber: member.memberNumber,
    firstName: member.firstName,
    lastName: member.lastName,
    fullName: `${member.firstName} ${member.lastName}`.trim(),
    nationalId: member.nationalId,
    phone: member.phone,
    email: member.email,
    employeeId: member.employeeId,
    employeeName: member.employee
      ? `${member.employee.firstName} ${member.employee.lastName}`.trim()
      : null,
    joinedAt: member.joinedAt.toISOString().slice(0, 10),
    status: member.status,
    notes: member.notes,
    balances: {
      shares: decimalToNumber(shares?.balance),
      bosa: decimalToNumber(bosa?.balance),
      fosa: decimalToNumber(fosa?.balance),
    },
  };
}

export function serializeAccount(account: SaccoAccount & { member?: SaccoMember }) {
  return {
    id: account.id,
    memberId: account.memberId,
    memberNumber: account.member?.memberNumber ?? null,
    memberName: account.member
      ? `${account.member.firstName} ${account.member.lastName}`.trim()
      : null,
    accountType: account.accountType,
    balance: decimalToNumber(account.balance),
    currency: account.currency,
    isActive: account.isActive,
    openedAt: account.openedAt.toISOString(),
  };
}

export function serializeLedgerEntry(entry: SaccoLedgerEntry) {
  return {
    id: entry.id,
    accountId: entry.accountId,
    entryType: entry.entryType,
    amount: decimalToNumber(entry.amount),
    balanceAfter: decimalToNumber(entry.balanceAfter),
    reference: entry.reference,
    description: entry.description,
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    createdAt: entry.createdAt.toISOString(),
  };
}

export function serializeDividendRun(
  run: SaccoDividendRun & { _count?: { lines: number }; lines?: SaccoDividendLine[] },
) {
  return {
    id: run.id,
    label: run.label,
    periodStart: run.periodStart.toISOString().slice(0, 10),
    periodEnd: run.periodEnd.toISOString().slice(0, 10),
    ratePercent: decimalToNumber(run.ratePercent),
    status: run.status,
    totalAmount: run.totalAmount == null ? null : decimalToNumber(run.totalAmount),
    memberCount: run._count?.lines ?? run.lines?.length ?? 0,
    approvedAt: run.approvedAt?.toISOString() ?? null,
    postedAt: run.postedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  };
}
