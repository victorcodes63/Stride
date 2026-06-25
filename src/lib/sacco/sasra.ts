import type { PrismaClient } from '@prisma/client';

export type SasraTemplateId = 'quarterly_summary' | 'loan_classification' | 'membership_register';

export const SASRA_TEMPLATES: Record<
  SasraTemplateId,
  { label: string; description: string; sasraForm: string }
> = {
  quarterly_summary: {
    label: 'Quarterly prudential summary',
    description: 'High-level membership, shares, BOSA/FOSA totals for board review.',
    sasraForm: 'SASRA-FORM-2A (illustrative)',
  },
  loan_classification: {
    label: 'Loan classification snapshot',
    description: 'Placeholder loan buckets — extend when credit module ships.',
    sasraForm: 'SASRA-FORM-2B (illustrative)',
  },
  membership_register: {
    label: 'Membership register extract',
    description: 'Active members with share balances for statutory filing support.',
    sasraForm: 'SASRA-FORM-1 (illustrative)',
  },
};

export async function buildSasraReport(
  db: PrismaClient,
  outsourcingClientId: string,
  templateId: SasraTemplateId,
) {
  const template = SASRA_TEMPLATES[templateId];
  const members = await db.saccoMember.findMany({
    where: { outsourcingClientId },
    include: { accounts: true },
    orderBy: { memberNumber: 'asc' },
  });

  const activeMembers = members.filter((m) => m.status === 'active');
  const sumByType = (type: 'shares' | 'bosa' | 'fosa') =>
    members.reduce((sum, member) => {
      const account = member.accounts.find((a) => a.accountType === type);
      return sum + Number(account?.balance ?? 0);
    }, 0);

  const base = {
    generatedAt: new Date().toISOString(),
    templateId,
    template,
    totals: {
      members: members.length,
      activeMembers: activeMembers.length,
      shares: sumByType('shares'),
      bosa: sumByType('bosa'),
      fosa: sumByType('fosa'),
    },
  };

  if (templateId === 'membership_register') {
    return {
      ...base,
      rows: activeMembers.map((m) => ({
        memberNumber: m.memberNumber,
        name: `${m.firstName} ${m.lastName}`.trim(),
        status: m.status,
        shares: Number(m.accounts.find((a) => a.accountType === 'shares')?.balance ?? 0),
        bosa: Number(m.accounts.find((a) => a.accountType === 'bosa')?.balance ?? 0),
        fosa: Number(m.accounts.find((a) => a.accountType === 'fosa')?.balance ?? 0),
      })),
    };
  }

  if (templateId === 'loan_classification') {
    return {
      ...base,
      loanBuckets: [
        { bucket: 'performing', amount: sumByType('bosa') * 0.82, pct: 82 },
        { bucket: 'watch', amount: sumByType('bosa') * 0.12, pct: 12 },
        { bucket: 'substandard', amount: sumByType('bosa') * 0.04, pct: 4 },
        { bucket: 'doubtful', amount: sumByType('bosa') * 0.02, pct: 2 },
      ],
      note: 'Illustrative classification from BOSA exposure — replace with live loan book when credit module ships.',
    };
  }

  return {
    ...base,
    quarterly: {
      periodLabel: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
      dividendRunsYtd: await db.saccoDividendRun.count({
        where: { outsourcingClientId, status: 'posted' },
      }),
    },
  };
}
