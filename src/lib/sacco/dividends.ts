import type { PrismaClient } from '@prisma/client';
import { postLedgerEntry } from './ledger';

export async function buildDividendAllocations(
  db: PrismaClient,
  outsourcingClientId: string,
  ratePercent: number,
) {
  const members = await db.saccoMember.findMany({
    where: { outsourcingClientId, status: 'active' },
    include: { accounts: { where: { accountType: 'shares' } } },
  });

  return members
    .map((member) => {
      const sharesBalance = Number(member.accounts[0]?.balance ?? 0);
      const dividendAmount = (sharesBalance * ratePercent) / 100;
      return {
        memberId: member.id,
        sharesBalance,
        dividendAmount: Math.round(dividendAmount * 100) / 100,
      };
    })
    .filter((row) => row.sharesBalance > 0);
}

export async function postDividendRun(db: PrismaClient, runId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const run = await tx.saccoDividendRun.findUniqueOrThrow({
      where: { id: runId },
      include: { lines: { include: { member: { include: { accounts: true } } } } },
    });

    if (run.status !== 'approved') {
      throw new Error('Only approved dividend runs can be posted.');
    }

    for (const line of run.lines) {
      const sharesAccount = line.member.accounts.find((a) => a.accountType === 'shares');
      if (!sharesAccount) continue;

      await postLedgerEntry(tx, {
        organizationId: run.organizationId,
        accountId: sharesAccount.id,
        entryType: 'dividend',
        amount: Number(line.dividendAmount),
        entryDate: run.periodEnd,
        reference: run.label,
        description: `Dividend @ ${Number(run.ratePercent)}%`,
        createdByUserId: userId,
      });
    }

    return tx.saccoDividendRun.update({
      where: { id: runId },
      data: { status: 'posted', postedAt: new Date() },
    });
  });
}
