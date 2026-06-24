import type { AccountsInvoicePaymentBank, Prisma, PrismaClient } from '@prisma/client';
import { getInvoiceBankDetails, type InvoicePaymentBankKind } from '@/lib/invoice-bank-accounts';

export type PaymentAccountDetails = {
  purposeTitle: string;
  accountName: string;
  bank: string;
  accountNumber: string;
  bankCode: string;
  branchCode: string;
  swiftCode: string;
};

export type PaymentAccountRow = {
  id: string;
  label: string;
  accountName: string;
  bank: string;
  accountNumber: string;
  bankCode: string;
  branchCode: string;
  swiftCode: string;
  purposeNotes: string | null;
  isPayrollOnly: boolean;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  legacyKind: AccountsInvoicePaymentBank | null;
};

const paymentAccountSelect = {
  id: true,
  label: true,
  accountName: true,
  bank: true,
  accountNumber: true,
  bankCode: true,
  branchCode: true,
  swiftCode: true,
  purposeNotes: true,
  isPayrollOnly: true,
  isDefault: true,
  isActive: true,
  sortOrder: true,
  legacyKind: true,
} satisfies Prisma.AccountsPaymentAccountSelect;

export function serializePaymentAccount(
  row: Prisma.AccountsPaymentAccountGetPayload<{ select: typeof paymentAccountSelect }>,
): PaymentAccountRow {
  return {
    id: row.id,
    label: row.label,
    accountName: row.accountName,
    bank: row.bank,
    accountNumber: row.accountNumber,
    bankCode: row.bankCode,
    branchCode: row.branchCode,
    swiftCode: row.swiftCode,
    purposeNotes: row.purposeNotes,
    isPayrollOnly: row.isPayrollOnly,
    isDefault: row.isDefault,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    legacyKind: row.legacyKind,
  };
}

export function paymentAccountToDetails(account: PaymentAccountRow): PaymentAccountDetails {
  const purposeTitle =
    account.purposeNotes?.trim() ||
    (account.isPayrollOnly
      ? 'Payroll only — pay into this account'
      : `${account.label} — pay into this account`);
  return {
    purposeTitle,
    accountName: account.accountName,
    bank: account.bank,
    accountNumber: account.accountNumber,
    bankCode: account.bankCode,
    branchCode: account.branchCode,
    swiftCode: account.swiftCode,
  };
}

/** Seed the two legacy accounts from env defaults when none exist. */
export async function ensureDefaultPaymentAccounts(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<void> {
  const count = await db.accountsPaymentAccount.count();
  if (count > 0) return;

  const consultancy = getInvoiceBankDetails('consultancy_fees');
  const payroll = getInvoiceBankDetails('payroll_only');

  await db.accountsPaymentAccount.createMany({
    data: [
      {
        label: 'Consultancy & other fees',
        accountName: consultancy.accountName,
        bank: consultancy.bank,
        accountNumber: consultancy.accountNumber,
        bankCode: consultancy.bankCode,
        branchCode: consultancy.branchCode,
        swiftCode: consultancy.swiftCode,
        purposeNotes: consultancy.purposeTitle,
        isPayrollOnly: false,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        legacyKind: 'consultancy_fees',
      },
      {
        label: 'Payroll only',
        accountName: payroll.accountName,
        bank: payroll.bank,
        accountNumber: payroll.accountNumber,
        bankCode: payroll.bankCode,
        branchCode: payroll.branchCode,
        swiftCode: payroll.swiftCode,
        purposeNotes: payroll.purposeTitle,
        isPayrollOnly: true,
        isDefault: false,
        isActive: true,
        sortOrder: 1,
        legacyKind: 'payroll_only',
      },
    ],
  });
}

export async function listActivePaymentAccounts(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<PaymentAccountRow[]> {
  await ensureDefaultPaymentAccounts(db);
  const rows = await db.accountsPaymentAccount.findMany({
    where: { isActive: true },
    select: paymentAccountSelect,
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  return rows.map(serializePaymentAccount);
}

export async function getDefaultPaymentAccountId(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<string | null> {
  await ensureDefaultPaymentAccounts(db);
  const row = await db.accountsPaymentAccount.findFirst({
    where: { isActive: true, isDefault: true },
    select: { id: true },
    orderBy: [{ sortOrder: 'asc' }],
  });
  if (row) return row.id;
  const fallback = await db.accountsPaymentAccount.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: [{ sortOrder: 'asc' }],
  });
  return fallback?.id ?? null;
}

export async function resolvePaymentAccountId(
  db: PrismaClient | Prisma.TransactionClient,
  input: { paymentAccountId?: string | null; paymentBank?: string | null },
): Promise<string | null> {
  await ensureDefaultPaymentAccounts(db);
  if (input.paymentAccountId) {
    const found = await db.accountsPaymentAccount.findFirst({
      where: { id: input.paymentAccountId, isActive: true },
      select: { id: true },
    });
    if (found) return found.id;
  }
  if (input.paymentBank === 'payroll_only' || input.paymentBank === 'consultancy_fees') {
    const byLegacy = await db.accountsPaymentAccount.findFirst({
      where: { legacyKind: input.paymentBank, isActive: true },
      select: { id: true },
    });
    if (byLegacy) return byLegacy.id;
  }
  return getDefaultPaymentAccountId(db);
}

export async function resolvePaymentDetails(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    paymentAccountId?: string | null;
    paymentBank?: InvoicePaymentBankKind | AccountsInvoicePaymentBank | null;
    paymentAccount?: PaymentAccountRow | null;
  },
): Promise<PaymentAccountDetails> {
  if (input.paymentAccount) {
    return paymentAccountToDetails(input.paymentAccount);
  }

  if (input.paymentAccountId) {
    const row = await db.accountsPaymentAccount.findUnique({
      where: { id: input.paymentAccountId },
      select: paymentAccountSelect,
    });
    if (row) return paymentAccountToDetails(serializePaymentAccount(row));
  }

  const bankKind =
    input.paymentBank === 'payroll_only' || input.paymentBank === 'consultancy_fees'
      ? input.paymentBank
      : 'consultancy_fees';

  const byLegacy = await db.accountsPaymentAccount.findFirst({
    where: { legacyKind: bankKind, isActive: true },
    select: paymentAccountSelect,
  });
  if (byLegacy) return paymentAccountToDetails(serializePaymentAccount(byLegacy));

  return getInvoiceBankDetails(bankKind);
}

export async function paymentBankForAccountId(
  db: PrismaClient | Prisma.TransactionClient,
  paymentAccountId: string,
): Promise<AccountsInvoicePaymentBank> {
  const row = await db.accountsPaymentAccount.findUnique({
    where: { id: paymentAccountId },
    select: { legacyKind: true, isPayrollOnly: true },
  });
  if (row?.legacyKind) return row.legacyKind;
  if (row?.isPayrollOnly) return 'payroll_only';
  return 'consultancy_fees';
}
