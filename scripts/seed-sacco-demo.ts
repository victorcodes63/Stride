/**
 * RAV-93: Seed SACCO members, ledger balances, and a sample dividend run for demo packs.
 */
import type { PrismaClient } from '@prisma/client';
import { createMemberWithAccounts, postLedgerEntry } from '../src/lib/sacco/ledger';

const DEMO_MEMBERS = [
  { firstName: 'Mary', lastName: 'Njoki', shares: 248500, bosa: 82000, fosa: 45000 },
  { firstName: 'John', lastName: 'Mutua', shares: 182000, bosa: 56000, fosa: 32000 },
  { firstName: 'Esther', lastName: 'Wambui', shares: 315750, bosa: 94000, fosa: 61000 },
  { firstName: 'Samuel', lastName: 'Kiprop', shares: 96400, bosa: 28000, fosa: 15000 },
  { firstName: 'Grace', lastName: 'Akinyi', shares: 156200, bosa: 41000, fosa: 22000 },
  { firstName: 'Peter', lastName: 'Ochieng', shares: 201300, bosa: 67000, fosa: 38000 },
];

export async function seedSaccoDemo(
  db: PrismaClient,
  organizationId: string,
  outsourcingClientId: string,
) {
  const existing = await db.saccoMember.count({ where: { outsourcingClientId } });
  if (existing > 0) {
    console.log('  SACCO demo already seeded — skipping');
    return;
  }

  console.log('  Seeding SACCO members and ledger…');

  for (let i = 0; i < DEMO_MEMBERS.length; i++) {
    const row = DEMO_MEMBERS[i];
    const member = await createMemberWithAccounts(db, {
      organizationId,
      outsourcingClientId,
      memberNumber: `MBR-${String(10480 + i).padStart(5, '0')}`,
      firstName: row.firstName,
      lastName: row.lastName,
      joinedAt: new Date('2020-01-15'),
      nationalId: `3${String(10000000 + i).slice(0, 8)}`,
    });

    const accounts = await db.saccoAccount.findMany({ where: { memberId: member.id } });
    const byType = Object.fromEntries(accounts.map((a) => [a.accountType, a])) as Record<
      string,
      (typeof accounts)[0]
    >;

    const entries: Array<{ type: 'shares' | 'bosa' | 'fosa'; amount: number }> = [
      { type: 'shares', amount: row.shares },
      { type: 'bosa', amount: row.bosa },
      { type: 'fosa', amount: row.fosa },
    ];

    for (const entry of entries) {
      const account = byType[entry.type];
      if (!account) continue;
      await db.$transaction((tx) =>
        postLedgerEntry(tx, {
          organizationId,
          accountId: account.id,
          entryType: 'contribution',
          amount: entry.amount,
          entryDate: new Date('2025-12-31'),
          description: 'Opening balance — demo seed',
        }),
      );
    }
  }

  const periodEnd = new Date('2026-06-30');
  const members = await db.saccoMember.findMany({
    where: { outsourcingClientId, status: 'active' },
    include: { accounts: { where: { accountType: 'shares' } } },
  });

  const ratePercent = 8;
  const lines = members
    .map((m) => {
      const sharesBalance = Number(m.accounts[0]?.balance ?? 0);
      return {
        memberId: m.id,
        sharesBalance,
        dividendAmount: Math.round(sharesBalance * ratePercent) / 100,
      };
    })
    .filter((l) => l.sharesBalance > 0);

  const totalAmount = lines.reduce((sum, l) => sum + l.dividendAmount, 0);

  await db.saccoDividendRun.create({
    data: {
      organizationId,
      outsourcingClientId,
      label: 'Q2 2026',
      periodStart: new Date('2026-04-01'),
      periodEnd,
      ratePercent,
      status: 'approved',
      totalAmount,
      approvedAt: new Date(),
      lines: {
        create: lines.map((line) => ({
          organizationId,
          memberId: line.memberId,
          sharesBalance: line.sharesBalance,
          dividendAmount: line.dividendAmount,
        })),
      },
    },
  });

  console.log(`  SACCO demo: ${members.length} members, Q2 2026 dividend run (approved)`);
}
